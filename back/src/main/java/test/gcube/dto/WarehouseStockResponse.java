package test.gcube.dto;

import test.gcube.entity.Stock;

/**
 * 창고별 재고 한 줄. 가용재고 = 현재고 - 예약수량.
 *
 * @param active 창고 운영상태. false 면 준비 판단에 쓰지 않는 재고다.
 */
public record WarehouseStockResponse(
        String warehouseCode,
        String warehouseName,
        boolean active,
        int quantity,
        int bookedQuantity,
        int availableQuantity
) {
    public static WarehouseStockResponse from(Stock stock) {
        return new WarehouseStockResponse(
                stock.getWarehouse().getCode(),
                stock.getWarehouse().getName(),
                stock.getWarehouse().isStatus(),
                stock.getQuantity(),
                stock.getBookedQuantity(),
                stock.getAvailableQuantity()
        );
    }
}
