package test.gcube.service;

import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import test.gcube.dto.OrderDetailResponse;
import test.gcube.dto.OrderReadinessResponse;
import test.gcube.entity.Item;
import test.gcube.entity.ItemUnit;
import test.gcube.entity.OrderReservation;
import test.gcube.entity.Orders;
import test.gcube.entity.Stock;
import test.gcube.entity.enums.LedgerType;
import test.gcube.entity.enums.ReadinessStatus;
import test.gcube.entity.enums.ReservationStatus;
import test.gcube.repository.ItemRepository;
import test.gcube.repository.ItemUnitRepository;
import test.gcube.repository.OrderReservationRepository;
import test.gcube.repository.OrdersRepository;
import test.gcube.repository.StockRepository;

/**
 * 예약 → 피킹 → 출고. 재고가 줄어드는 쪽의 명령을 처리한다. (요구사항 3-4)
 *
 * <p>정합성 장치
 * <ul>
 *   <li>재고는 바꾸기 직전에 {@code SELECT ... FOR UPDATE} 로 다시 읽는다.
 *       화면에서 본 숫자를 믿지 않는다.</li>
 *   <li>한 품목이라도 예약할 수 없으면 예외를 던져 트랜잭션 전체를 되돌린다.
 *       일부만 잡힌 상태가 남지 않는다.</li>
 *   <li>중복 요청은 상태로 걸러낸다. 이미 예약이 있으면 다시 예약하지 않고,
 *       이미 출고된 주문은 다시 출고하지 않는다.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Transactional
public class OrderCommandService {

    private final OrdersRepository ordersRepository;
    private final OrderReservationRepository orderReservationRepository;
    private final StockRepository stockRepository;
    private final ItemRepository itemRepository;
    private final ItemUnitRepository itemUnitRepository;
    private final ReadinessPlanner readinessPlanner;
    private final OrderQueryService orderQueryService;
    private final StockLedgerRecorder ledgerRecorder;

    /**
     * 재고 예약. 현재고만으로 전량 준비되는 주문만 예약할 수 있다.
     *
     * <p>이미 예약이 있으면 아무것도 바꾸지 않고 현재 상태를 돌려준다. 반복 호출해도 안전하다.
     */
    public OrderDetailResponse reserve(String orderNumber) {
        Orders order = findOrder(orderNumber);

        if (orderReservationRepository.existsByOrderId(order.getId())) {
            return orderQueryService.findByOrderNumber(orderNumber); // 이미 예약됨
        }

        OrderReadinessResponse readiness = readinessPlanner.plan(orderNumber);
        if (!ReadinessStatus.valueOf(readiness.status()).isReservable()) {
            throw new IllegalStateException(
                    "'%s' 상태라 예약할 수 없습니다. 현재고만으로 전량 준비되는 주문만 예약합니다."
                            .formatted(readiness.statusLabel()));
        }

        Long warehouseId = order.getWarehouse().getId();
        for (var demand : readiness.demands()) {
            Item item = itemRepository.findByCode(demand.itemCode()).orElseThrow();
            // 판정 때 본 숫자를 믿지 않고 행을 잠그고 다시 읽는다
            Stock stock = stockRepository.findForUpdate(warehouseId, item.getId())
                    .orElseThrow(() -> new IllegalStateException(
                            "%s 의 재고 정보가 없습니다.".formatted(demand.itemCode())));

            // 가용재고가 모자라면 예외가 나고 앞서 잡은 예약까지 전부 되돌아간다
            stock.reserve(demand.requiredQuantity());

            orderReservationRepository.save(OrderReservation.builder()
                    .order(order).item(item).stock(stock)
                    .quantity(demand.requiredQuantity())
                    .build());

            ledgerRecorder.record(stock, order, null, LedgerType.RESERVE,
                    0, demand.requiredQuantity(),
                    "%s 예약".formatted(order.getOrderNumber()));
        }

        return orderQueryService.findByOrderNumber(orderNumber);
    }

    /**
     * 시리얼 피킹. 예약된 시리얼 관리 품목에 실제 개체를 연결한다.
     *
     * <p>이미 배정된 개체는 다시 고르지 않으므로 반복 호출해도 개체가 늘지 않는다.
     */
    public OrderDetailResponse pick(String orderNumber) {
        Orders order = findOrder(orderNumber);

        // 같은 주문을 동시에 피킹해도 순서대로 처리되도록 예약 행을 먼저 잠근다
        List<OrderReservation> reservations =
                orderReservationRepository.findByOrderIdForUpdate(order.getId());
        if (reservations.isEmpty()) {
            throw new IllegalStateException("예약되지 않은 주문은 피킹할 수 없습니다.");
        }

        for (OrderReservation reservation : reservations) {
            if (!reservation.getItem().isSerial()) {
                continue;
            }
            int already = itemUnitRepository
                    .findAssignedForUpdate(order.getId(), reservation.getStock().getId()).size();
            int need = reservation.getQuantity() - already;
            if (need <= 0) {
                continue; // 이미 필요한 만큼 배정되어 있다
            }

            List<ItemUnit> candidates = itemUnitRepository.findPickable(reservation.getStock().getId());
            if (candidates.size() < need) {
                throw new IllegalStateException(
                        "%s 의 보관 중인 개체가 %d 개뿐이라 %d 개를 배정할 수 없습니다."
                                .formatted(reservation.getItem().getCode(), candidates.size(), need));
            }
            candidates.subList(0, need).forEach(unit -> unit.assignTo(order));
        }

        return orderQueryService.findByOrderNumber(orderNumber);
    }

    /**
     * 출고. 현재고와 예약수량을 함께 줄이고 배정된 개체를 판매완료로 바꾼다.
     *
     * <p>이미 출고된 주문은 아무것도 바꾸지 않는다. 반복 호출해도 재고가 두 번 줄지 않는다.
     */
    public OrderDetailResponse ship(String orderNumber) {
        Orders order = findOrder(orderNumber);

        if (!order.isPreparationTarget()) {
            // 이미 출고·배송 완료거나 취소된 주문
            return orderQueryService.findByOrderNumber(orderNumber);
        }

        List<OrderReservation> reservations =
                orderReservationRepository.findByOrderIdForUpdate(order.getId());
        if (reservations.isEmpty()) {
            throw new IllegalStateException("예약되지 않은 주문은 출고할 수 없습니다.");
        }

        List<String> missingSerials = new ArrayList<>();
        for (OrderReservation reservation : reservations) {
            if (reservation.getStatus() == ReservationStatus.SHIPPED) {
                continue;
            }
            if (reservation.getItem().isSerial()) {
                int picked = itemUnitRepository
                        .findAssignedForUpdate(order.getId(), reservation.getStock().getId())
                        .size();
                if (picked < reservation.getQuantity()) {
                    missingSerials.add("%s (%d/%d)".formatted(
                            reservation.getItem().getCode(), picked, reservation.getQuantity()));
                }
            }
        }
        if (!missingSerials.isEmpty()) {
            throw new IllegalStateException(
                    "시리얼 피킹이 끝나지 않아 출고할 수 없습니다: " + String.join(", ", missingSerials));
        }

        for (OrderReservation reservation : reservations) {
            if (reservation.getStatus() == ReservationStatus.SHIPPED) {
                continue;
            }
            Stock stock = stockRepository.findByIdForUpdate(reservation.getStock().getId())
                    .orElseThrow();
            stock.ship(reservation.getQuantity());
            reservation.ship();

            ledgerRecorder.record(stock, order, null, LedgerType.SHIP,
                    -reservation.getQuantity(), -reservation.getQuantity(),
                    "%s 출고".formatted(order.getOrderNumber()));
        }

        itemUnitRepository.findByOrderIdWithRefs(order.getId()).forEach(ItemUnit::ship);
        order.ship();

        return orderQueryService.findByOrderNumber(orderNumber);
    }

    private Orders findOrder(String orderNumber) {
        return ordersRepository.findByOrderNumberWithWarehouse(orderNumber)
                .orElseThrow(() -> new NoSuchElementException("없는 주문번호입니다: " + orderNumber));
    }
}
