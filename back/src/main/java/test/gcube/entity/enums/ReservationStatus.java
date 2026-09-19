package test.gcube.entity.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** 주문 예약 상태. order_reservation.status 에 이름 그대로 저장된다. */
@Getter
@RequiredArgsConstructor
public enum ReservationStatus {

    /** 예약됨. stock.booked_quantity 를 차지하고 있다. */
    RESERVED("예약"),
    /** 출고 완료. 현재고와 예약수량에서 함께 빠졌다. */
    SHIPPED("출고완료");

    private final String label;
}
