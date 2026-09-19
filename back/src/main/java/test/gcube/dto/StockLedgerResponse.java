package test.gcube.dto;

import java.time.LocalDateTime;
import test.gcube.entity.StockLedger;

/** 재고가 바뀐 기록 한 줄. 변화량과 변화 후 값을 함께 보여 준다. */
public record StockLedgerResponse(
        String type,
        String typeLabel,
        String itemCode,
        String warehouseCode,
        String orderNumber,
        String scheduleCode,
        int quantityDelta,
        int bookedDelta,
        int quantityAfter,
        int bookedAfter,
        String memo,
        LocalDateTime createdAt
) {
    public static StockLedgerResponse from(StockLedger ledger) {
        return new StockLedgerResponse(
                ledger.getType().name(),
                ledger.getType().getLabel(),
                ledger.getStock().getItem().getCode(),
                ledger.getStock().getWarehouse().getCode(),
                ledger.getOrder() == null ? null : ledger.getOrder().getOrderNumber(),
                ledger.getStockSchedule() == null ? null : ledger.getStockSchedule().getCode(),
                ledger.getQuantityDelta(),
                ledger.getBookedDelta(),
                ledger.getQuantityAfter(),
                ledger.getBookedAfter(),
                ledger.getMemo(),
                ledger.getCreatedAt());
    }
}
