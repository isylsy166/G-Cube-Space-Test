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
        String assignedOrderNumber,
        /** 앱 밖에서 잡은 개체인지. 화면이 링크를 걸지 말지 판단한다. */
        boolean assignedOutside
) {
    public static ItemUnitResponse from(ItemUnit unit) {
        return new ItemUnitResponse(
                unit.getSerialNumber(),
                unit.getStock().getWarehouse().getCode(),
                unit.getLocation(),
                unit.getStatus().name(),
                unit.getStatus().getLabel(),
                unit.getStatus().isOnHand(),
                unit.assignedOrderNumber(),
                unit.getOrder() == null && unit.getExternalReference() != null);
    }
}
