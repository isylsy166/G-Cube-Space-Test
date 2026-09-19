package test.gcube.entity.enums;

import java.util.Arrays;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** 주문 상태. orders.order_status 에 이름 그대로 저장된다. */
@Getter
@RequiredArgsConstructor
public enum OrderStatus {

    /** 주문 확정. 새 출고 준비 대상이다. */
    CONFIRMED("주문 확정"),
    /** 취소 */
    CANCELED("취소"),
    /** 출고 완료 */
    SHIPPED("출고 완료"),
    /** 배송 완료 */
    DELIVERED("배송 완료");

    private final String label;

    public static OrderStatus ofLabel(String label) {
        return Arrays.stream(values())
                .filter(it -> it.label.equals(label))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("알 수 없는 주문 상태: " + label));
    }
}
