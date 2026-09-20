package test.gcube.dto;

import java.time.LocalDateTime;
import test.gcube.entity.OrderReservation;

/**
 * 잡혀 있는 재고 한 줄.
 *
 * @param holderOrderNumber 이 수량을 잡고 있는 주문번호
 * @param managedHere       이 앱이 처리한 예약인지. 아니면 기준시각 이전에 이미 잡혀 있던 것이다
 */
public record ReservationResponse(
        String holderOrderNumber,
        boolean managedHere,
        String itemCode,
        String itemName,
        String warehouseCode,
        int quantity,
        String status,
        String statusLabel,
        LocalDateTime createdAt
) {
    public static ReservationResponse from(OrderReservation reservation) {
        return new ReservationResponse(
                reservation.holderOrderNumber(),
                reservation.isManagedHere(),
                reservation.getItem().getCode(),
                reservation.getItem().getName(),
                reservation.getStock().getWarehouse().getCode(),
                reservation.getQuantity(),
                reservation.getStatus().name(),
                reservation.getStatus().getLabel(),
                reservation.getCreatedAt());
    }
}
