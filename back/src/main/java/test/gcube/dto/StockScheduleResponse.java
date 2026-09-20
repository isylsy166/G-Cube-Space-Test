package test.gcube.dto;

import java.time.LocalDateTime;
import test.gcube.entity.StockSchedule;

/**
 * 입고 예정 문서 한 줄. 발주 페이지 목록이 그대로 쓰는 형태다.
 *
 * @param remainingQuantity  앞으로 들어올 수량 (계획수량 - 입고수량)
 * @param inspectedQuantity  검사를 통과한 수량. 생산의뢰만 의미가 있다
 * @param receivableQuantity 지금 입고할 수 있는 수량. 생산의뢰는 검사 통과분까지만이다
 * @param usableQuantity     준비 판단이 세는 수량. 검사를 마친 생산의뢰는 불합격분이 빠진다
 * @param usableForPlanning 준비 판단에 쓸 수 있는 문서인지.
 *                          미확정, 사용 중지된 창고, 검사 불합격 문서는 제외한다.
 *                          판단 기준은 {@link StockSchedule#isUsableForPlanning()} 하나만 쓴다.
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
        int inspectedQuantity,
        int receivableQuantity,
        int usableQuantity,
        LocalDateTime availableAt,
        String status,
        String statusLabel,
        String inspectStatus,
        String inspectStatusLabel,
        boolean confirmed,
        boolean usableForPlanning
) {
    public static StockScheduleResponse from(StockSchedule schedule) {
        boolean warehouseActive = schedule.getWarehouse().isActive();
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
                schedule.getInspectedQuantity(),
                schedule.getReceivableQuantity(),
                schedule.getUsableQuantity(),
                schedule.getAvailableAt(),
                schedule.getStatus() == null ? null : schedule.getStatus().name(),
                schedule.getStatus() == null ? null : schedule.getStatus().getLabel(),
                schedule.getInspectStatus().name(),
                schedule.getInspectStatus().getLabel(),
                schedule.isConfirmed(),
                schedule.isUsableForPlanning()
        );
    }
}
