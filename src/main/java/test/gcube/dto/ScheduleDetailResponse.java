package test.gcube.dto;

import java.util.List;

/**
 * 발주 페이지 상세. (요구사항 4-3)
 *
 * @param sourceOrderNumber 이 문서를 만들게 한 주문. 제공된 기존 문서는 null.
 * @param ledgers           이 문서의 입고로 현재고가 어떻게 바뀌었는지
 */
public record ScheduleDetailResponse(
        StockScheduleResponse schedule,
        String sourceOrderNumber,
        List<StockLedgerResponse> ledgers
) {
}
