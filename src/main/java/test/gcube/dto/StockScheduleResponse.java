package test.gcube.dto;

import java.time.LocalDateTime;
import test.gcube.entity.StockSchedule;

/**
 * 입고 예정 문서 한 줄. 발주 페이지 목록이 그대로 쓰는 형태다.
 *
 * @param remainingQuantity 앞으로 들어올 수량 (계획수량 - 입고수량)
 * @param usableForPlanning 준비 판단에 쓸 수 있는 문서인지.
 *                          미확정 문서와 사용 중지된 창고의 문서는 제외한다.
 */
public record StockScheduleResponse(
        String code,
        String type,
        String typeLabel,
        String itemCode,
        String itemName,
        String warehouseCode,
        String warehouseName,
        boolean warehouseActive,
        String supplierCode,
        String supplierName,
        int leadTimeDays,
        int planQuantity,
        int receivedQuantity,
        int remainingQuantity,
        LocalDateTime availableAt,
        String status,
        String statusLabel,
        String inspectStatus,
        String inspectStatusLabel,
        boolean confirmed,
        boolean usableForPlanning
) {
    public static StockScheduleResponse from(StockSchedule schedule) {
        boolean warehouseActive = schedule.getWarehouse().isStatus();
        return new StockScheduleResponse(
                schedule.getCode(),
                schedule.getType().name(),
                schedule.getType().getLabel(),
                schedule.getItem().getCode(),
                schedule.getItem().getName(),
                schedule.getWarehouse().getCode(),
                schedule.getWarehouse().getName(),
                warehouseActive,
                schedule.getSupplier().getCode(),
                schedule.getSupplier().getName(),
                schedule.getSupplier().getLeadTimeDays(),
                schedule.getPlanQuantity(),
                schedule.getReceivedQuantity(),
                schedule.getRemainingQuantity(),
                schedule.getAvailableAt(),
                schedule.getStatus() == null ? null : schedule.getStatus().name(),
                schedule.getStatus() == null ? null : schedule.getStatus().getLabel(),
                schedule.getInspectStatus().name(),
                schedule.getInspectStatus().getLabel(),
                schedule.isConfirmed(),
                schedule.isConfirmed() && warehouseActive && schedule.getRemainingQuantity() > 0
        );
    }
}
