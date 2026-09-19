package test.gcube.entity.enums;

import java.util.Arrays;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** 품목 개체 상태. item_unit.status 에 이름 그대로 저장된다. */
@Getter
@RequiredArgsConstructor
public enum ItemUnitStatus {

    /** 창고 보관 중 (정상) */
    NORMAL("창고 보관 중"),
    /** 주문 배정됨 (예약) */
    RESERVED("주문 배정됨"),
    /** 출고 완료 (판매완료) */
    SOLD("출고 완료");

    private final String label;

    public static ItemUnitStatus ofLabel(String label) {
        return Arrays.stream(values())
                .filter(it -> it.label.equals(label))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("알 수 없는 개체 상태: " + label));
    }

    /** 창고에 남아 있어 현재고로 세는 상태인지 */
    public boolean isOnHand() {
        return this == NORMAL || this == RESERVED;
    }
}
