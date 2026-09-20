package test.gcube.dto;

import java.util.List;
import java.time.LocalDateTime;
import test.gcube.entity.Orders;

/**
 * 주문 목록 한 줄. 준비가 막힌 주문이 바로 눈에 띄도록 판정 결과를 함께 담는다.
 *
 * <p>세트를 전개한 준비 품목({@code demands})까지 함께 싣는다. 이게 없으면 화면이
 * 부족 품목과 배송일별 준비 수량을 그리려고 주문 수만큼 상세를 다시 호출해야 하고,
 * 상세 한 건은 전역 판정을 한 번씩 더 돌린다. 목록 한 번에 판정이 N+1 회 도는 셈이다.
 * 판정은 어차피 전체를 한 번에 계산하므로, 그 결과를 여기서 같이 내려 주는 편이 맞다.
 *
 * @param preparationTarget 새 출고 준비 대상인지. 주문 확정 상태만 해당한다.
 * @param readinessStatus   준비 판정 결과. 준비 대상이 아닌 주문은 null.
 * @param demands           세트 전개 후 실제 준비 품목과 수량·부족분. 준비 대상이 아니면 빈 목록.
 * @param reviewReasons     확인이 필요한 사유. 없으면 빈 목록.
 * @param reserved          재고 예약을 마쳤는지
 * @param picked            시리얼 개체를 배정했는지. 예약 → 피킹 → 출고 중 어디까지 왔는지 보여 준다.
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
        String readinessStatusLabel,
        List<DemandAllocationResponse> demands,
        List<String> reviewReasons,
        boolean reserved,
        boolean picked
) {
    public static OrderSummaryResponse of(Orders order, OrderReadinessResponse readiness) {
        return of(order, readiness, false, false);
    }

    public static OrderSummaryResponse of(Orders order, OrderReadinessResponse readiness,
                                          boolean reserved, boolean picked) {
        return new OrderSummaryResponse(
                order.getOrderNumber(),
                order.getWarehouse().getCode(),
                order.getWarehouse().getName(),
                order.getWarehouse().isActive(),
                order.getOrderStatus().name(),
                order.getOrderStatus().getLabel(),
                order.getDeliveryAt(),
                order.getCreatedAt(),
                order.isPreparationTarget(),
                readiness == null ? null : readiness.status(),
                readiness == null ? null : readiness.statusLabel(),
                readiness == null ? List.of() : readiness.demands(),
                readiness == null ? List.of() : readiness.reviewReasons(),
                reserved,
                picked);
    }
}
