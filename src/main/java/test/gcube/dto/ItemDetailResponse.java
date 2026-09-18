package test.gcube.dto;

import java.util.List;

/**
 * 제품 페이지 상세. (요구사항 4-1)
 *
 * @param waitingOrders 이 품목을 기다리는 주문. 준비가 막힌 주문이 먼저 온다.
 * @param schedules     이 품목으로 걸려 있는 발주·생산 문서
 * @param ledgers       예약·출고·입고로 수량이 어떻게 바뀌었는지
 */
public record ItemDetailResponse(
        ItemSummaryResponse item,
        List<WarehouseStockResponse> stocks,
        List<ItemUnitResponse> units,
        List<WaitingOrderResponse> waitingOrders,
        List<StockScheduleResponse> schedules,
        List<StockLedgerResponse> ledgers
) {
}
