package test.gcube.dto;

import java.time.LocalDateTime;
import test.gcube.entity.OrderReservation;

/** 이 주문이 잡아둔 재고 한 줄. */
public record ReservationResponse(
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
                reservation.getItem().getCode(),
                reservation.getItem().getName(),
                reservation.getStock().getWarehouse().getCode(),
                reservation.getQuantity(),
                reservation.getStatus().name(),
                reservation.getStatus().getLabel(),
                reservation.getCreatedAt());
    }
}
