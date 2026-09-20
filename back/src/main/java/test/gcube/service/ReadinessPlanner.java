package test.gcube.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import test.gcube.dto.DemandAllocationResponse;
import test.gcube.dto.OrderReadinessResponse;
import test.gcube.entity.ItemSetComponent;
import test.gcube.entity.OrderDetail;
import test.gcube.entity.Orders;
import test.gcube.entity.Stock;
import test.gcube.entity.StockSchedule;
import test.gcube.entity.enums.InspectStatus;
import test.gcube.entity.enums.OrderLineStatus;
import test.gcube.entity.enums.ReadinessStatus;
import test.gcube.entity.enums.ScheduleType;
import test.gcube.repository.OrderDetailRepository;
import test.gcube.repository.OrderReservationRepository;
import test.gcube.repository.OrdersRepository;
import test.gcube.repository.StockRepository;
import test.gcube.repository.StockScheduleRepository;

/**
 * 배송일이 빠른 주문부터 재고와 입고예정을 나눠 주며 주문별 준비 가능 여부를 판정한다.
 * (요구사항 3-2, 3-3, 3-6)
 *
 * <p>핵심은 <b>전역 배분</b>이다. 주문을 하나씩 따로 보면 같은 재고를 여러 주문이 중복으로
 * 세어 전부 "준비 가능"으로 보이므로, 우선순위대로 훑으면서 앞선 주문이 가져간 수량을
 * 풀에서 빼고 다음 주문을 판정한다.
 *
 * <p>판정만 하고 아무것도 저장하지 않는다. 실제 예약은 {@code ReservationService} 가 한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReadinessPlanner {

    private final OrdersRepository ordersRepository;
    private final OrderDetailRepository orderDetailRepository;
    private final OrderReservationRepository orderReservationRepository;
    private final StockRepository stockRepository;
    private final StockScheduleRepository stockScheduleRepository;
    private final SetExpander setExpander;

    /** 준비 대상 주문 전체를 우선순위대로 판정한다. 키는 주문번호다. */
    public Map<String, OrderReadinessResponse> planAll() {
        List<Orders> orders = ordersRepository.findPreparationTargets();

        Map<Long, List<OrderDetail>> detailsByOrder = orders.isEmpty()
                ? Map.of()
                : orderDetailRepository.findByOrderIdInWithRefs(
                                orders.stream().map(Orders::getId).toList()).stream()
                        .collect(Collectors.groupingBy(d -> d.getOrder().getId()));

        Map<Long, List<ItemSetComponent>> componentsBySet = setExpander.loadComponents(
                detailsByOrder.values().stream().flatMap(List::stream).toList());

        StockPool stockPool = StockPool.of(stockRepository.findAllWithRefs());
        SchedulePool schedulePool = SchedulePool.of(stockScheduleRepository.findAllWithRefs());
        Set<Long> reserved = new HashSet<>(orderReservationRepository.findReservedOrderIds());

        Map<String, OrderReadinessResponse> result = new LinkedHashMap<>();
        for (Orders order : orders) {
            List<OrderDetail> details = detailsByOrder.getOrDefault(order.getId(), List.of());
            result.put(order.getOrderNumber(),
                    plan(order, details, componentsBySet, stockPool, schedulePool, reserved));
        }
        return result;
    }

    /**
     * 한 주문의 판정 결과. 전역 배분 결과 안에서의 값이어야 의미가 있으므로
     * 전체를 판정한 뒤 해당 주문만 꺼낸다.
     */
    public OrderReadinessResponse plan(String orderNumber) {
        OrderReadinessResponse readiness = planAll().get(orderNumber);
        if (readiness != null) {
            return readiness;
        }
        // 준비 대상이 아닌 주문(취소·출고완료·배송완료). 사람이 손봐야 하는 '확인 필요' 와
        // 구분한다. 이미 끝난 주문이 담당자의 처리 목록에 섞이면 안 된다.
        Orders order = ordersRepository.findByOrderNumberWithWarehouse(orderNumber).orElseThrow();
        return new OrderReadinessResponse(
                order.getOrderNumber(),
                order.getWarehouse().getCode(),
                order.getDeliveryAt(),
                ReadinessStatus.NOT_APPLICABLE.name(),
                ReadinessStatus.NOT_APPLICABLE.getLabel(),
                List.of(),
                List.of("주문 상태가 '%s' 라서 새 출고 준비 대상이 아닙니다."
                        .formatted(order.getOrderStatus().getLabel())));
    }

    private OrderReadinessResponse plan(Orders order, List<OrderDetail> details,
                                        Map<Long, List<ItemSetComponent>> componentsBySet,
                                        StockPool stockPool, SchedulePool schedulePool,
                                        Set<Long> reservedOrderIds) {
        List<String> reviewReasons = reviewReasons(order, details);
        if (!reviewReasons.isEmpty()) {
            // 확인이 필요한 주문은 재고를 건드리지 않는다. 풀도 소비하지 않는다. (요구사항 3-6)
            return response(order, ReadinessStatus.REVIEW_REQUIRED, List.of(), reviewReasons);
        }

        if (reservedOrderIds.contains(order.getId())) {
            // 이미 예약이 잡힌 주문. 필요 수량은 stock.booked_quantity 에 이미 빠져 있으므로
            // 풀에서 또 빼면 안 된다. 다시 빼면 자기 예약 때문에 자기가 재고 부족으로 보이고,
            // 뒤 주문들은 실제보다 재고가 적다고 판단하게 된다.
            List<Allocation> held = setExpander.expand(details, componentsBySet).stream()
                    .map(d -> new Allocation(d, d.quantity(), d.quantity(), 0, 0, List.of()))
                    .toList();
            return response(order, ReadinessStatus.READY, held, List.of());
        }

        Long warehouseId = order.getWarehouse().getId();
        LocalDate usableBy = order.getDeliveryAt().toLocalDate().minusDays(1);

        List<Allocation> allocations = new ArrayList<>();
        for (ItemDemand demand : setExpander.expand(details, componentsBySet)) {
            Long itemId = demand.item().getId();
            int required = demand.quantity();

            int available = stockPool.available(warehouseId, itemId);
            int fromStock = Math.min(available, required);

            int remaining = required - fromStock;
            List<SchedulePortion> usedSchedules = new ArrayList<>();
            int fromSchedule = 0;
            for (SchedulePortion portion : schedulePool.portions(warehouseId, itemId, usableBy)) {
                if (remaining == 0) {
                    break;
                }
                int take = Math.min(portion.remaining, remaining);
                if (take > 0) {
                    usedSchedules.add(new SchedulePortion(portion.schedule, take));
                    fromSchedule += take;
                    remaining -= take;
                }
            }

            allocations.add(new Allocation(
                    demand, available, fromStock, fromSchedule, remaining, usedSchedules));
        }

        boolean shortage = allocations.stream().anyMatch(a -> a.shortage > 0);
        if (shortage) {
            // 일부 품목만 가능해도 그 주문을 위해 미리 잡아두지 않는다. (요구사항 3-3)
            return response(order, ReadinessStatus.SHORTAGE, allocations, List.of());
        }

        // 준비 가능한 주문만 풀에서 실제로 차감한다. 뒤 주문이 같은 수량을 다시 쓰지 못한다.
        for (Allocation allocation : allocations) {
            stockPool.consume(warehouseId, allocation.demand.item().getId(), allocation.fromStock);
            allocation.usedSchedules.forEach(p -> schedulePool.consume(p.schedule, p.remaining));
        }

        return response(order, readinessOf(allocations), allocations, List.of());
    }

    /** 현재고만으로 되면 바로 준비 가능, 아니면 기다리는 원인 중 가장 앞선 단계를 보여 준다. */
    private ReadinessStatus readinessOf(List<Allocation> allocations) {
        ReadinessStatus worst = ReadinessStatus.READY;
        for (Allocation allocation : allocations) {
            for (SchedulePortion portion : allocation.usedSchedules) {
                ReadinessStatus cause = causeOf(portion.schedule);
                if (severity(cause) > severity(worst)) {
                    worst = cause;
                }
            }
        }
        return worst;
    }

    private ReadinessStatus causeOf(StockSchedule schedule) {
        if (schedule.getType() == ScheduleType.PRODUCTION) {
            return schedule.getInspectStatus() == InspectStatus.WAITING_INSPECTION
                    ? ReadinessStatus.WAIT_INSPECTION
                    : ReadinessStatus.WAIT_PRODUCTION;
        }
        return ReadinessStatus.WAIT_PURCHASE;
    }

    private int severity(ReadinessStatus status) {
        return switch (status) {
            case READY -> 0;
            case WAIT_PURCHASE -> 1;
            case WAIT_PRODUCTION -> 2;
            case WAIT_INSPECTION -> 3;
            default -> 4;
        };
    }

    /** 자동 처리하면 안 되는 주문의 사유. (요구사항 3-6) */
    private List<String> reviewReasons(Orders order, List<OrderDetail> details) {
        List<String> reasons = new ArrayList<>();

        if (!order.getWarehouse().isStatus()) {
            reasons.add("출고창고 %s 가 사용 중지 상태입니다. 창고 확인이 필요합니다."
                    .formatted(order.getWarehouse().getCode()));
        }
        if (order.getDeliveryAt() == null) {
            reasons.add("배송예정일이 없습니다. 일정 확인이 필요합니다.");
        }
        if (details.isEmpty()) {
            reasons.add("주문 상세가 없습니다. 주문 내용을 확인해 주세요.");
        }
        // 어느 코드가 문제인지 그대로 보여 준다. "등록되지 않은 품목이 있다" 까지만 말하면
        // 담당자는 무엇을 등록해야 할지 알 수 없다. (요구사항 3-6)
        details.stream()
                .filter(OrderDetail::isUnregistered)
                .filter(d -> d.getStatus() == OrderLineStatus.NORMAL)
                .forEach(d -> reasons.add(
                        "%d번 품목 '%s' 가 품목으로 등록되어 있지 않습니다. 품목 등록 후 다시 확인해 주세요."
                                .formatted(d.getSequence(), d.getRawItemCode())));
        details.stream()
                .filter(OrderDetail::isPreparable)
                .filter(d -> d.getOrderQuantity() <= 0)
                .forEach(d -> reasons.add("%d번 품목의 주문 수량이 %d 입니다. 수량 확인이 필요합니다."
                        .formatted(d.getSequence(), d.getOrderQuantity())));

        return reasons;
    }

    private OrderReadinessResponse response(Orders order, ReadinessStatus status,
                                            List<Allocation> allocations, List<String> reasons) {
        return new OrderReadinessResponse(
                order.getOrderNumber(),
                order.getWarehouse().getCode(),
                order.getDeliveryAt(),
                status.name(),
                status.getLabel(),
                allocations.stream().map(Allocation::toResponse).toList(),
                reasons);
    }

    // ---------- 판정 중에만 쓰는 작업용 구조 ----------

    private record Allocation(ItemDemand demand, int available, int fromStock, int fromSchedule,
                              int shortage, List<SchedulePortion> usedSchedules) {

        DemandAllocationResponse toResponse() {
            return new DemandAllocationResponse(
                    demand.item().getCode(),
                    demand.item().getName(),
                    demand.item().getType().name(),
                    demand.item().getType().getLabel(),
                    demand.item().isSerial(),
                    demand.quantity(),
                    available,
                    fromStock,
                    fromSchedule,
                    shortage,
                    usedSchedules.stream().map(p -> p.schedule.getCode()).toList());
        }
    }

    private record SchedulePortion(StockSchedule schedule, int remaining) {
    }

    /** 창고·품목별 가용재고 풀. 사용 중지된 창고는 애초에 담지 않는다. (요구사항 3-2) */
    private static final class StockPool {
        private final Map<String, Integer> available = new LinkedHashMap<>();

        static StockPool of(List<Stock> stocks) {
            StockPool pool = new StockPool();
            for (Stock stock : stocks) {
                if (!stock.getWarehouse().isStatus()) {
                    continue;
                }
                pool.available.put(
                        key(stock.getWarehouse().getId(), stock.getItem().getId()),
                        stock.getAvailableQuantity());
            }
            return pool;
        }

        int available(Long warehouseId, Long itemId) {
            return available.getOrDefault(key(warehouseId, itemId), 0);
        }

        void consume(Long warehouseId, Long itemId, int amount) {
            available.merge(key(warehouseId, itemId), -amount, Integer::sum);
        }

        private static String key(Long warehouseId, Long itemId) {
            return warehouseId + ":" + itemId;
        }
    }

    /**
     * 창고·품목별 입고예정 풀. 확정되지 않았거나, 사용 중지된 창고로 들어오거나,
     * 남은 수량이 없거나, 검사에서 불합격한 문서는 담지 않는다. (요구사항 3-2)
     *
     * <p>담을지 말지는 {@link StockSchedule#isUsableForPlanning()} 한 곳에서만 판단한다.
     * 화면의 "판정 반영 / 제외" 표시도 같은 메서드를 쓰므로 둘이 어긋나지 않는다.
     */
    private static final class SchedulePool {
        private final Map<String, List<StockSchedule>> schedules = new LinkedHashMap<>();
        private final Map<Long, Integer> remaining = new LinkedHashMap<>();

        static SchedulePool of(List<StockSchedule> all) {
            SchedulePool pool = new SchedulePool();
            for (StockSchedule schedule : all) {
                if (!schedule.isUsableForPlanning()) {
                    continue;
                }
                pool.schedules.computeIfAbsent(
                                StockPool.key(schedule.getWarehouse().getId(),
                                        schedule.getItem().getId()),
                                k -> new ArrayList<>())
                        .add(schedule);
                // 남은 계획수량이 아니라 '실제로 들어올 수 있는 수량'을 담는다.
                // 검사를 마친 생산의뢰는 불합격분이 빠진다.
                pool.remaining.put(schedule.getId(), schedule.getUsableQuantity());
            }
            pool.schedules.values().forEach(list -> list.sort(
                    (a, b) -> a.getAvailableAt().compareTo(b.getAvailableAt())));
            return pool;
        }

        /** 배송일 전날까지 쓸 수 있다고 확정된 문서만 준다. (요구사항 3-2) */
        List<SchedulePortion> portions(Long warehouseId, Long itemId, LocalDate usableBy) {
            return schedules.getOrDefault(StockPool.key(warehouseId, itemId), List.of()).stream()
                    .filter(s -> !s.getAvailableAt().toLocalDate().isAfter(usableBy))
                    .map(s -> new SchedulePortion(s, remaining.getOrDefault(s.getId(), 0)))
                    .filter(p -> p.remaining > 0)
                    .toList();
        }

        void consume(StockSchedule schedule, int amount) {
            remaining.merge(schedule.getId(), -amount, Integer::sum);
        }
    }
}
