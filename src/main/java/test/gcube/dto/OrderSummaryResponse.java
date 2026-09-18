package test.gcube.dto;

import java.time.LocalDateTime;
import test.gcube.entity.Orders;

/**
 * 주문 목록 한 줄. 준비가 막힌 주문이 바로 눈에 띄도록 판정 결과를 함께 담는다.
 *
 * @param preparationTarget 새 출고 준비 대상인지. 주문 확정 상태만 해당한다.
 * @param readinessStatus   준비 판정 결과. 준비 대상이 아닌 주문은 null.
 */
public record OrderSummaryResponse(
        String orderNumber,
        String warehouseCode,
        String warehouseName,
        boolean warehouseActive,
        String orderStatus,
        String orderStatusLabel,
        LocalDateTime deliveryAt,
        LocalDateTime createdAt,
        boolean preparationTarget,
        String readinessStatus,
        String readinessStatusLabel
) {
    public static OrderSummaryResponse of(Orders order, OrderReadinessResponse readiness) {
        return new OrderSummaryResponse(
                order.getOrderNumber(),
                order.getWarehouse().getCode(),
                order.getWarehouse().getName(),
                order.getWarehouse().isStatus(),
                order.getOrderStatus().name(),
                order.getOrderStatus().getLabel(),
                order.getDeliveryAt(),
                order.getCreatedAt(),
                order.isPreparationTarget(),
                readiness == null ? null : readiness.status(),
                readiness == null ? null : readiness.statusLabel());
    }
}
