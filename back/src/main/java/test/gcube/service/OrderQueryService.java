package test.gcube.service;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import test.gcube.dto.ItemUnitResponse;
import test.gcube.dto.OrderDetailResponse;
import test.gcube.dto.OrderLineResponse;
import test.gcube.dto.OrderReadinessResponse;
import test.gcube.dto.OrderSummaryResponse;
import test.gcube.dto.PickableUnitsResponse;
import test.gcube.dto.ReservationResponse;
import test.gcube.dto.StockLedgerResponse;
import test.gcube.dto.StockScheduleResponse;
import test.gcube.entity.ItemSetComponent;
import test.gcube.entity.ItemUnit;
import test.gcube.entity.OrderReservation;
import test.gcube.entity.OrderDetail;
import test.gcube.entity.Orders;
import test.gcube.entity.enums.OrderStatus;
import test.gcube.entity.enums.ReadinessStatus;
import test.gcube.repository.ItemUnitRepository;
import test.gcube.repository.OrderDetailRepository;
import test.gcube.repository.OrderReservationRepository;
import test.gcube.repository.OrdersRepository;
import test.gcube.repository.StockLedgerRepository;
import test.gcube.repository.StockScheduleRepository;

/** 주문 페이지(요구사항 4-2) 조회. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrderQueryService {

    private final OrdersRepository ordersRepository;
    private final OrderDetailRepository orderDetailRepository;
    private final OrderReservationRepository orderReservationRepository;
    private final ItemUnitRepository itemUnitRepository;
    private final StockScheduleRepository stockScheduleRepository;
    private final StockLedgerRepository stockLedgerRepository;
    private final ReadinessPlanner readinessPlanner;
    private final SetExpander setExpander;

    /**
     * 배송예정일·접수일시 순으로 정렬한 주문 목록에 준비 판정을 붙인다.
     *
     * @param status    null 이면 전체 주문 상태
     * @param readiness null 이면 전체 준비 상태
     * @param warehouseCode null 이면 전체 창고
     */
    public List<OrderSummaryResponse> findAll(OrderStatus status, ReadinessStatus readiness,
                                              String warehouseCode) {
        Map<String, OrderReadinessResponse> plans = readinessPlanner.planAll();

        return ordersRepository.findAllWithWarehouse().stream()
                .filter(o -> status == null || o.getOrderStatus() == status)
                .filter(o -> warehouseCode == null
                        || warehouseCode.equals(o.getWarehouse().getCode()))
                .map(o -> OrderSummaryResponse.of(o, plans.get(o.getOrderNumber())))
                .filter(o -> readiness == null || readiness.name().equals(o.readinessStatus()))
                .toList();
    }

    /**
     * 직접 선택 화면에 필요한 개체 목록. 시리얼 관리 품목의 예약마다
     * 이미 배정된 개체와 아직 고를 수 있는 개체를 함께 준다.
     *
     * <p>조회 시점의 후보일 뿐이다. 다른 담당자가 먼저 집어간 개체는
     * 피킹 때 잠그고 다시 확인해 사유와 함께 거절된다.
     */
    public List<PickableUnitsResponse> findPickableUnits(String orderNumber) {
        Orders order = ordersRepository.findByOrderNumberWithWarehouse(orderNumber)
                .orElseThrow(() -> new NoSuchElementException("없는 주문번호입니다: " + orderNumber));

        Map<Long, List<ItemUnit>> assignedByStockId =
                itemUnitRepository.findByOrderIdWithRefs(order.getId()).stream()
                        .collect(Collectors.groupingBy(u -> u.getStock().getId()));

        return orderReservationRepository.findByOrderIdWithRefs(order.getId()).stream()
                .filter(r -> r.getItem().isSerial())
                .map(r -> toPickableUnits(r, assignedByStockId.getOrDefault(
                        r.getStock().getId(), List.of())))
                .toList();
    }

    private PickableUnitsResponse toPickableUnits(OrderReservation reservation,
                                                  List<ItemUnit> assigned) {
        return new PickableUnitsResponse(
                reservation.getItem().getCode(),
                reservation.getItem().getName(),
                reservation.getStock().getWarehouse().getCode(),
                reservation.getQuantity(),
                assigned.size(),
                Math.max(0, reservation.getQuantity() - assigned.size()),
                assigned.stream().map(ItemUnitResponse::from).toList(),
                itemUnitRepository.findSelectableWithRefs(reservation.getStock().getId()).stream()
                        .map(ItemUnitResponse::from).toList());
    }

    public OrderDetailResponse findByOrderNumber(String orderNumber) {
        Orders order = ordersRepository.findByOrderNumberWithWarehouse(orderNumber)
                .orElseThrow(() -> new NoSuchElementException("없는 주문번호입니다: " + orderNumber));

        OrderReadinessResponse readiness = readinessPlanner.plan(orderNumber);

        // 원 주문 라인에 세트 구성품을 붙여, 아래 readiness.demands 로 어떻게 전개됐는지
        // 화면에서 대응이 보이게 한다. (요구사항 4-2)
        List<OrderDetail> lines = orderDetailRepository.findByOrderIdWithRefs(order.getId());
        Map<Long, List<ItemSetComponent>> componentsBySet = setExpander.loadComponents(lines);

        return new OrderDetailResponse(
                OrderSummaryResponse.of(order, order.isPreparationTarget() ? readiness : null),
                lines.stream().map(d -> OrderLineResponse.from(d, componentsBySet)).toList(),
                readiness,
                orderReservationRepository.findByOrderIdWithRefs(order.getId()).stream()
                        .map(ReservationResponse::from).toList(),
                itemUnitRepository.findByOrderIdWithRefs(order.getId()).stream()
                        .map(ItemUnitResponse::from).toList(),
                stockScheduleRepository.findByOrderIdWithRefs(order.getId()).stream()
                        .map(StockScheduleResponse::from).toList(),
                stockLedgerRepository.findByOrderIdWithRefs(order.getId()).stream()
                        .map(StockLedgerResponse::from).toList());
    }
}
