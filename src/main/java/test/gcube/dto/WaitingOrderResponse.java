package test.gcube.dto;

import java.time.LocalDateTime;

/** 이 품목을 기다리고 있는 주문 한 줄. */
public record WaitingOrderResponse(
        String orderNumber,
        String warehouseCode,
        LocalDateTime deliveryAt,
        String readinessStatus,
        String readinessStatusLabel,
        int requiredQuantity,
        int shortageQuantity
) {
}
