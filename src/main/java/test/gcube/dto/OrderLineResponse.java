package test.gcube.dto;

import test.gcube.entity.OrderDetail;

/** 주문에 원래 적힌 그대로의 한 줄. 세트 주문이면 kind 가 SET 이다. */
public record OrderLineResponse(
        int sequence,
        String kind,
        String code,
        String name,
        int orderQuantity,
        String status,
        String statusLabel
) {
    public static OrderLineResponse from(OrderDetail detail) {
        boolean set = detail.isSetOrder();
        return new OrderLineResponse(
                detail.getSequence(),
                set ? "SET" : "ITEM",
                set ? detail.getItemSet().getCode() : detail.getItem().getCode(),
                set ? detail.getItemSet().getName() : detail.getItem().getName(),
                detail.getOrderQuantity(),
                detail.getStatus().name(),
                detail.getStatus().getLabel());
    }
}
