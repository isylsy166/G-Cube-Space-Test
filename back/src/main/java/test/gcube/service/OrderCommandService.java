package test.gcube.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.stream.Collectors;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import test.gcube.dto.DemandAllocationResponse;
import test.gcube.dto.OrderDetailResponse;
import test.gcube.dto.OrderReadinessResponse;
import test.gcube.entity.Item;
import test.gcube.entity.ItemUnit;
import test.gcube.entity.OrderReservation;
import test.gcube.entity.Orders;
import test.gcube.entity.Stock;
import test.gcube.entity.enums.ItemUnitStatus;
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
 *   <li>재고는 바꾸기 직전에 행을 잠그고 DB 의 최신 값으로 다시 읽는다.
 *       화면에서 본 숫자도, 판정 때 읽어 둔 숫자도 믿지 않는다.</li>
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
    private final EntityManager entityManager;

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

        // 품목코드 순으로 잠근다. 주문 라인 순서대로 잠그면 A 주문이 X→Y, B 주문이 Y→X 를
        // 동시에 잡을 때 서로를 기다리다 데드락이 난다. 모든 요청이 같은 순서로 잠그면
        // 뒤에 온 요청은 첫 행에서 막혀 기다릴 뿐 엇갈리지 않는다.
        // 피킹도 같은 이유로 시리얼번호 순으로 잠근다.
        List<DemandAllocationResponse> demands = readiness.demands().stream()
                .sorted(Comparator.comparing(DemandAllocationResponse::itemCode))
                .toList();

        for (DemandAllocationResponse demand : demands) {
            Item item = itemRepository.findByCode(demand.itemCode()).orElseThrow();
            Stock stock = stockRepository.findByWarehouseIdAndItemId(warehouseId, item.getId())
                    .orElseThrow(() -> new IllegalStateException(
                            "%s 의 재고 정보가 없습니다.".formatted(demand.itemCode())));

            // 판정 때 본 숫자를 믿지 않고 행을 잠그고 다시 읽는다. (요구사항 3-4)
            //
            // 여기서 조회만 다시 하면 안 된다. 바로 위 판정이 같은 트랜잭션에서 전 재고를 이미
            // 읽어 1차 캐시에 올려 두었기 때문에, select ... for update 를 날려도 하이버네이트는
            // 읽어온 값을 버리고 캐시에 있던 옛날 인스턴스를 돌려준다. 락만 잡히고 숫자는 낡는다.
            // refresh 는 행을 잠그면서 엔티티 상태를 DB 값으로 덮어쓴다.
            entityManager.refresh(stock, LockModeType.PESSIMISTIC_WRITE);

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
     * 시리얼 피킹(자동 배정). 보관 중인 개체를 시리얼번호 순으로 필요한 수만큼 배정한다.
     *
     * <p>이미 배정된 개체는 다시 고르지 않으므로 반복 호출해도 개체가 늘지 않는다.
     */
    public OrderDetailResponse pick(String orderNumber) {
        return pick(orderNumber, List.of());
    }

    /**
     * 시리얼 피킹. 담당자가 고른 시리얼번호가 있으면 그 개체만 배정하고,
     * 비어 있으면 자동으로 고른다. (요구사항 3-4)
     *
     * <p>직접 선택도 자동 배정과 같은 장치를 쓴다. 예약 행과 개체 행을 잠그고 읽어
     * 같은 개체가 두 주문에 들어가지 않게 하고, 예약수량을 넘겨 배정하지 않는다.
     * 이미 이 주문에 배정된 개체를 다시 보내도 개체가 늘지 않는다.
     */
    public OrderDetailResponse pick(String orderNumber, List<String> serialNumbers) {
        Orders order = findOrder(orderNumber);

        // 같은 주문을 동시에 피킹해도 순서대로 처리되도록 예약 행을 먼저 잠근다
        List<OrderReservation> reservations =
                orderReservationRepository.findByOrderIdForUpdate(order.getId());
        if (reservations.isEmpty()) {
            throw new IllegalStateException("예약되지 않은 주문은 피킹할 수 없습니다.");
        }

        List<String> chosen = normalize(serialNumbers);
        if (chosen.isEmpty()) {
            pickAutomatically(order, reservations);
        } else {
            pickChosen(order, reservations, chosen);
        }

        return orderQueryService.findByOrderNumber(orderNumber);
    }

    /** 보관 중인 개체를 시리얼번호 순으로 모자란 만큼 채운다. */
    private void pickAutomatically(Orders order, List<OrderReservation> reservations) {
        for (OrderReservation reservation : reservations) {
            if (!reservation.getItem().isSerial()) {
                continue;
            }
            int need = shortfallOf(order, reservation);
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
    }

    /**
     * 담당자가 고른 개체만 배정한다. 한 건이라도 조건에 맞지 않으면 예외를 던져
     * 아무것도 배정하지 않는다. 일부만 배정된 상태가 남지 않는다.
     */
    private void pickChosen(Orders order, List<OrderReservation> reservations,
                            List<String> serialNumbers) {
        // 시리얼 품목의 예약을 재고(창고+품목)별로 펼쳐 둔다. 고른 개체가 어느 예약에
        // 속하는지, 그 예약이 몇 개까지 받을 수 있는지를 여기서 찾는다.
        Map<Long, OrderReservation> reservationByStockId = reservations.stream()
                .filter(r -> r.getItem().isSerial())
                .collect(Collectors.toMap(r -> r.getStock().getId(), r -> r));
        if (reservationByStockId.isEmpty()) {
            throw new IllegalStateException("이 주문에는 시리얼 관리 품목이 없어 개체를 고를 수 없습니다.");
        }

        List<ItemUnit> units = itemUnitRepository.findBySerialNumbersForUpdate(serialNumbers);
        if (units.size() != serialNumbers.size()) {
            Set<String> found = units.stream().map(ItemUnit::getSerialNumber)
                    .collect(Collectors.toSet());
            throw new NoSuchElementException("없는 시리얼번호입니다: " + serialNumbers.stream()
                    .filter(no -> !found.contains(no)).collect(Collectors.joining(", ")));
        }

        List<ItemUnit> toAssign = new ArrayList<>();
        Map<Long, Integer> addedByStockId = new HashMap<>();
        for (ItemUnit unit : units) {
            if (isAssignedTo(unit, order)) {
                continue; // 이미 이 주문 것이다. 다시 보내도 늘지 않는다
            }
            OrderReservation reservation = reservationByStockId.get(unit.getStock().getId());
            if (reservation == null) {
                throw new IllegalStateException(
                        "%s 은(는) 이 주문이 예약한 재고의 개체가 아닙니다. 주문의 출고창고와 품목을 확인해 주세요."
                                .formatted(unit.getSerialNumber()));
            }
            if (!unit.isPickable()) {
                // 다른 주문에 배정되었거나 이미 출고된 개체
                throw new IllegalStateException("%s 은(는) '%s' 상태라 이 주문에 배정할 수 없습니다."
                        .formatted(unit.getSerialNumber(), unit.getStatus().getLabel()));
            }
            toAssign.add(unit);
            addedByStockId.merge(unit.getStock().getId(), 1, Integer::sum);
        }

        // 예약한 수량보다 많이 실어 보내지 않는다
        for (Map.Entry<Long, Integer> entry : addedByStockId.entrySet()) {
            OrderReservation reservation = reservationByStockId.get(entry.getKey());
            int room = shortfallOf(order, reservation);
            if (entry.getValue() > room) {
                throw new IllegalStateException(
                        "%s 은(는) 예약 %d 개 중 %d 개를 더 고를 수 있는데 %d 개를 선택했습니다."
                                .formatted(reservation.getItem().getCode(), reservation.getQuantity(),
                                        room, entry.getValue()));
            }
        }

        toAssign.forEach(unit -> unit.assignTo(order));
    }

    /**
     * 배정 해제. 직접 선택에서 잘못 고른 개체를 보관 중으로 되돌린다.
     *
     * <p>출고된 개체는 되돌리지 않는다. 출고를 취소하는 기능이 아니다.
     */
    public OrderDetailResponse unpick(String orderNumber, String serialNumber) {
        Orders order = findOrder(orderNumber);
        if (!order.isPreparationTarget()) {
            throw new IllegalStateException("출고·배송이 끝났거나 취소된 주문은 배정을 해제할 수 없습니다.");
        }

        // 피킹과 같은 순서로 잠가 둘이 엇갈려 기다리지 않게 한다
        orderReservationRepository.findByOrderIdForUpdate(order.getId());

        ItemUnit unit = itemUnitRepository.findBySerialNumberForUpdate(serialNumber)
                .orElseThrow(() -> new NoSuchElementException("없는 시리얼번호입니다: " + serialNumber));
        if (!isAssignedTo(unit, order)) {
            throw new IllegalStateException(
                    "%s 은(는) 이 주문에 배정된 개체가 아닙니다.".formatted(serialNumber));
        }
        if (unit.getStatus() != ItemUnitStatus.RESERVED) {
            throw new IllegalStateException("%s 은(는) '%s' 상태라 배정을 해제할 수 없습니다."
                    .formatted(serialNumber, unit.getStatus().getLabel()));
        }

        unit.release();
        return orderQueryService.findByOrderNumber(orderNumber);
    }

    /** 이 예약에 아직 몇 개를 더 배정해야 하는지. 배정된 개체는 잠그고 센다. */
    private int shortfallOf(Orders order, OrderReservation reservation) {
        int already = itemUnitRepository
                .findAssignedForUpdate(order.getId(), reservation.getStock().getId()).size();
        return reservation.getQuantity() - already;
    }

    private boolean isAssignedTo(ItemUnit unit, Orders order) {
        return unit.getOrder() != null && unit.getOrder().getId().equals(order.getId());
    }

    /** 공백과 중복을 걷어낸다. 같은 시리얼을 두 번 적어 보내도 한 개로 센다. */
    private List<String> normalize(List<String> serialNumbers) {
        if (serialNumbers == null) {
            return List.of();
        }
        return serialNumbers.stream()
                .filter(no -> no != null && !no.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
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
