package test.gcube.dto;

import java.util.List;

/**
 * 주문 상세. 원 주문 라인, 세트 전개 후 판정 결과, 처리 진행 상황을 한 번에 준다.
 *
 * @param readiness     준비 가능 여부 판정 (요구사항 3-3)
 * @param reservations  이 주문이 잡아둔 재고
 * @param pickedUnits   이 주문에 배정된 시리얼 개체
 * @param schedules     이 주문 때문에 생긴 발주·생산의뢰 (요구사항 3-5)
 * @param ledgers       이 주문으로 생긴 재고 변화 이력
 */
public record OrderDetailResponse(
        OrderSummaryResponse order,
        List<OrderLineResponse> lines,
        OrderReadinessResponse readiness,
        List<ReservationResponse> reservations,
        List<ItemUnitResponse> pickedUnits,
        List<StockScheduleResponse> schedules,
        List<StockLedgerResponse> ledgers
) {
}
