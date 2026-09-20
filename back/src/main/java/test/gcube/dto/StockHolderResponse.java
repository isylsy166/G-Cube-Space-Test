package test.gcube.dto;

import test.gcube.entity.OrderReservation;

/**
 * 이 재고의 예약수량을 누가 잡고 있는지 한 줄. (요구사항 4-1)
 *
 * @param managedHere 이 앱이 처리한 예약인지. false 면 기준시각에 이미 잡혀 있던 예약이라
 *                    주문 상세로 넘어갈 수 없다.
 */
public record StockHolderResponse(
        String orderNumber,
        boolean managedHere,
        String warehouseCode,
        int quantity
) {
    public static StockHolderResponse from(OrderReservation reservation) {
        return new StockHolderResponse(
                reservation.holderOrderNumber(),
                reservation.isManagedHere(),
                reservation.getStock().getWarehouse().getCode(),
                reservation.getQuantity());
    }
}
