package test.gcube.dto;

import test.gcube.entity.ItemUnit;

/** 시리얼 관리 품목의 개체 한 줄. */
public record ItemUnitResponse(
        String serialNumber,
        String warehouseCode,
        String location,
        String status,
        String statusLabel,
        boolean onHand,
        String assignedOrderNumber
) {
    public static ItemUnitResponse from(ItemUnit unit) {
        return new ItemUnitResponse(
                unit.getSerialNumber(),
                unit.getStock().getWarehouse().getCode(),
                unit.getLocation(),
                unit.getStatus().name(),
                unit.getStatus().getLabel(),
                unit.getStatus().isOnHand(),
                unit.getOrder() == null ? null : unit.getOrder().getOrderNumber());
    }
}
