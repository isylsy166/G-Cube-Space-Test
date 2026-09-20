package test.gcube.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.NoSuchElementException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import test.gcube.dto.InspectionRequest;
import test.gcube.dto.OrderReadinessResponse;
import test.gcube.dto.ReceiptRequest;
import test.gcube.dto.ScheduleCreateRequest;
import test.gcube.dto.StockScheduleResponse;
import test.gcube.entity.Item;
import test.gcube.entity.ItemUnit;
import test.gcube.entity.Orders;
import test.gcube.entity.Stock;
import test.gcube.entity.StockSchedule;
import test.gcube.entity.Supplier;
import test.gcube.entity.Warehouse;
import test.gcube.entity.enums.InspectStatus;
import test.gcube.entity.enums.ItemType;
import test.gcube.entity.enums.ItemUnitStatus;
import test.gcube.entity.enums.LedgerType;
import test.gcube.entity.enums.ReadinessStatus;
import test.gcube.entity.enums.ScheduleStatus;
import test.gcube.entity.enums.ScheduleType;
import test.gcube.repository.ItemRepository;
import test.gcube.repository.ItemUnitRepository;
import test.gcube.repository.OrdersRepository;
import test.gcube.repository.StockRepository;
import test.gcube.repository.StockScheduleRepository;
import test.gcube.repository.SupplierRepository;

/**
 * 발주·생산의뢰 생성과 검사·입고. 재고가 늘어나는 쪽의 명령을 처리한다. (요구사항 3-5)
 *
 * <p>정합성 장치
 * <ul>
 *   <li>발주를 만드는 것만으로는 현재고가 늘지 않는다. 입고 처리에서만 늘린다.</li>
 *   <li>누적 입고수량이 계획수량을 넘으면 {@link StockSchedule#receive(int)} 가 거부한다.</li>
 *   <li>생산의뢰는 검사 통과 전에는 입고할 수 없다.</li>
 *   <li>발주 생성과 입고는 멱등 키로 중복 반영을 막는다.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ScheduleCommandService {

    private final StockScheduleRepository stockScheduleRepository;
    private final OrdersRepository ordersRepository;
    private final ItemRepository itemRepository;
    private final SupplierRepository supplierRepository;
    private final StockRepository stockRepository;
    private final ItemUnitRepository itemUnitRepository;
    private final ReadinessPlanner readinessPlanner;
    private final IdempotencyGuard idempotencyGuard;
    private final StockLedgerRecorder ledgerRecorder;
    private final Clock clock;

    /**
     * 부족 주문에서 발주·생산의뢰를 만든다.
     * 매입품이면 구매발주, 생산품이면 생산의뢰가 된다. 서비스 품목은 발주 대상이 아니다.
     */
    public StockScheduleResponse createFromOrder(String orderNumber, ScheduleCreateRequest request,
                                                 String idempotencyKey) {
        String code = idempotencyGuard.runOnce(idempotencyKey, "SCHEDULE_CREATE",
                () -> create(orderNumber, request));
        return StockScheduleResponse.from(stockScheduleRepository.findByCodeWithRefs(code)
                .orElseThrow());
    }

    private String create(String orderNumber, ScheduleCreateRequest request) {
        Orders order = ordersRepository.findByOrderNumberWithWarehouse(orderNumber)
                .orElseThrow(() -> new NoSuchElementException("없는 주문번호입니다: " + orderNumber));

        Warehouse warehouse = order.getWarehouse();
        if (!warehouse.isStatus()) {
            throw new IllegalStateException(
                    "사용 중지된 창고(%s)로는 발주할 수 없습니다.".formatted(warehouse.getCode()));
        }

        // 확인이 필요한 주문은 사람이 먼저 손봐야 하므로 발주 대상이 아니다. (요구사항 3-6)
        // 화면이 버튼을 감추는 것과 별개로 API 에서도 막는다. 수량을 직접 지정해 부르면
        // 아래 부족수량 조회를 건너뛰기 때문에, 여기서 걸러내지 않으면 규칙이 뚫린다.
        OrderReadinessResponse readiness = readinessPlanner.plan(orderNumber);
        if (ReadinessStatus.REVIEW_REQUIRED.name().equals(readiness.status())) {
            throw new IllegalStateException("확인이 필요한 주문은 발주 대상이 아닙니다. "
                    + String.join(" ", readiness.reviewReasons()));
        }

        Item item = itemRepository.findByCode(request.itemCode())
                .orElseThrow(() -> new NoSuchElementException(
                        "등록되지 않은 품목입니다: " + request.itemCode()));
        if (item.getType().isStockless()) {
            throw new IllegalStateException(
                    "서비스 품목(%s)은 발주 대상이 아닙니다.".formatted(item.getCode()));
        }

        int quantity = request.quantity() != null
                ? request.quantity()
                : shortageOf(readiness, item.getCode());
        if (quantity <= 0) {
            throw new IllegalStateException(
                    "%s 은 부족 수량이 없어 발주할 필요가 없습니다.".formatted(item.getCode()));
        }

        Supplier supplier = request.supplierCode() != null
                ? supplierRepository.findByCode(request.supplierCode())
                        .orElseThrow(() -> new NoSuchElementException(
                                "없는 공급처입니다: " + request.supplierCode()))
                : item.getSupplier();

        ScheduleType type = item.getType() == ItemType.MANUFACTURED
                ? ScheduleType.PRODUCTION
                : ScheduleType.PURCHASE;

        StockSchedule schedule = StockSchedule.builder()
                .supplier(supplier)
                .warehouse(warehouse)
                .item(item)
                .code(nextCode(type))
                .type(type)
                .status(ScheduleStatus.CONFIRMED)
                .planQuantity(quantity)
                .receivedQuantity(0)
                // 사용 가능 예정일 기본값은 공급처 리드타임으로 제안한다
                .availableAt(LocalDate.now(clock).plusDays(supplier.getLeadTimeDays()).atStartOfDay())
                .inspectStatus(type == ScheduleType.PRODUCTION
                        ? InspectStatus.BEFORE_INSPECTION
                        : InspectStatus.NOT_APPLICABLE)
                .confirmed(true)
                .order(order)
                .build();

        return stockScheduleRepository.save(schedule).getCode();
    }

    /** 검사 결과 기록. 통과해야 입고할 수 있다. */
    public StockScheduleResponse inspect(String code, InspectionRequest request) {
        StockSchedule schedule = findScheduleForUpdate(code);
        if (schedule.getType() != ScheduleType.PRODUCTION) {
            throw new IllegalStateException("구매발주는 품질검사 대상이 아닙니다.");
        }
        schedule.inspect(request.passed());
        return StockScheduleResponse.from(schedule);
    }

    /**
     * 입고 처리. 현재고를 늘리고, 시리얼 관리 품목이면 개체를 그만큼 만든다.
     * 같은 멱등 키로 다시 부르면 아무것도 늘지 않는다.
     */
    public StockScheduleResponse receive(String code, ReceiptRequest request,
                                         String idempotencyKey) {
        idempotencyGuard.runOnce(idempotencyKey, "SCHEDULE_RECEIVE",
                () -> doReceive(code, request.quantity()));
        return StockScheduleResponse.from(findSchedule(code));
    }

    private String doReceive(String code, int quantity) {
        StockSchedule schedule = findScheduleForUpdate(code);

        if (!schedule.isConfirmed()) {
            throw new IllegalStateException("확정되지 않은 문서는 입고할 수 없습니다.");
        }
        if (schedule.getType() == ScheduleType.PRODUCTION
                && schedule.getInspectStatus() != InspectStatus.INSPECTED) {
            throw new IllegalStateException(
                    "생산의뢰는 품질검사를 통과해야 입고할 수 있습니다. 현재 검사 상태: "
                            + schedule.getInspectStatus().getLabel());
        }

        // 계획수량 초과는 여기서 막힌다
        schedule.receive(quantity);

        Stock stock = stockRepository
                .findForUpdate(schedule.getWarehouse().getId(), schedule.getItem().getId())
                .orElseGet(() -> stockRepository.save(Stock.builder()
                        .warehouse(schedule.getWarehouse())
                        .item(schedule.getItem())
                        .quantity(0)
                        .bookedQuantity(0)
                        .build()));
        stock.receive(quantity);

        if (schedule.getItem().isSerial()) {
            createUnits(schedule, stock, quantity);
        }

        ledgerRecorder.record(stock, schedule.getOrder(), schedule, LedgerType.RECEIVE,
                quantity, 0, "%s 입고".formatted(schedule.getCode()));

        return schedule.getCode();
    }

    /** 시리얼 관리 품목은 입고 수량만큼 개체가 생겨야 하고 시리얼번호는 중복될 수 없다. */
    private void createUnits(StockSchedule schedule, Stock stock, int quantity) {
        long sequence = itemUnitRepository.countByStockId(stock.getId());
        for (int i = 0; i < quantity; i++) {
            String serialNumber;
            do {
                sequence++;
                serialNumber = "%s-%s-%04d".formatted(
                        schedule.getCode(), schedule.getItem().getCode(), sequence);
            } while (itemUnitRepository.existsBySerialNumber(serialNumber));

            itemUnitRepository.save(ItemUnit.builder()
                    .stock(stock)
                    .serialNumber(serialNumber)
                    .location(null)
                    .status(ItemUnitStatus.NORMAL)
                    .build());
        }
    }

    /** 미확정 문서를 확정으로 바꾼다. (요구사항 4-5 선택 사항) */
    public StockScheduleResponse confirm(String code) {
        StockSchedule schedule = findScheduleForUpdate(code);
        schedule.confirm();
        return StockScheduleResponse.from(schedule);
    }

    private int shortageOf(OrderReadinessResponse readiness, String itemCode) {
        return readiness.demands().stream()
                .filter(d -> d.itemCode().equals(itemCode))
                .mapToInt(d -> d.shortageQuantity())
                .findFirst()
                .orElse(0);
    }

    /** 문서번호는 유형과 날짜, 그날의 일련번호로 만든다. */
    private String nextCode(ScheduleType type) {
        String prefix = "%s-%s-".formatted(
                type == ScheduleType.PRODUCTION ? "MO" : "PO",
                LocalDate.now(clock).toString().replace("-", ""));
        return prefix + "%03d".formatted(stockScheduleRepository.countByCodeStartingWith(prefix) + 1);
    }

    private StockSchedule findScheduleForUpdate(String code) {
        return stockScheduleRepository.findByCodeForUpdate(code)
                .orElseThrow(() -> new NoSuchElementException("없는 문서번호입니다: " + code));
    }

    private StockSchedule findSchedule(String code) {
        return stockScheduleRepository.findByCodeWithRefs(code)
                .orElseThrow(() -> new NoSuchElementException("없는 문서번호입니다: " + code));
    }
}
