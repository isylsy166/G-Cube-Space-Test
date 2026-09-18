package test.gcube.service;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import test.gcube.dto.ItemUnitResponse;
import test.gcube.dto.OrderDetailResponse;
import test.gcube.dto.OrderLineResponse;
import test.gcube.dto.OrderReadinessResponse;
import test.gcube.dto.OrderSummaryResponse;
import test.gcube.dto.ReservationResponse;
import test.gcube.dto.StockLedgerResponse;
import test.gcube.dto.StockScheduleResponse;
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

    public OrderDetailResponse findByOrderNumber(String orderNumber) {
        Orders order = ordersRepository.findByOrderNumberWithWarehouse(orderNumber)
                .orElseThrow(() -> new NoSuchElementException("없는 주문번호입니다: " + orderNumber));

        OrderReadinessResponse readiness = readinessPlanner.plan(orderNumber);

        return new OrderDetailResponse(
                OrderSummaryResponse.of(order, order.isPreparationTarget() ? readiness : null),
                orderDetailRepository.findByOrderIdWithRefs(order.getId()).stream()
                        .map(OrderLineResponse::from).toList(),
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
