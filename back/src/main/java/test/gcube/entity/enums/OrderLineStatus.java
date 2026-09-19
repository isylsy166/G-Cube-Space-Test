package test.gcube.entity.enums;

import java.util.Arrays;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** 주문 상세의 품목 상태. order_detail.status 에 이름 그대로 저장된다. */
@Getter
@RequiredArgsConstructor
public enum OrderLineStatus {

    /** 정상 */
    NORMAL("정상"),
    /** 취소. 같은 주문 안에 기록은 남지만 준비 수량에서 제외한다. */
    CANCELED("취소");

    private final String label;

    public static OrderLineStatus ofLabel(String label) {
        return Arrays.stream(values())
                .filter(it -> it.label.equals(label))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("알 수 없는 품목 상태: " + label));
    }
}
