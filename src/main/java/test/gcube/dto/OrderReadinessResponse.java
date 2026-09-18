package test.gcube.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 주문 준비 판정 결과. (요구사항 3-3)
 *
 * @param reviewReasons 자동 처리하면 안 되는 사유. 비어 있지 않으면 재고를 건드리지 않는다. (요구사항 3-6)
 */
public record OrderReadinessResponse(
        String orderNumber,
        String warehouseCode,
        LocalDateTime deliveryAt,
        String status,
        String statusLabel,
        List<DemandAllocationResponse> demands,
        List<String> reviewReasons
) {
    public boolean hasShortage() {
        return demands.stream().anyMatch(d -> d.shortageQuantity() > 0);
    }
}
