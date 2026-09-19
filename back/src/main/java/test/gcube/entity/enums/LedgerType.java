package test.gcube.entity.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** 재고 이력 유형. stock_ledger.type 에 이름 그대로 저장된다. */
@Getter
@RequiredArgsConstructor
public enum LedgerType {

    /** 예약. 현재고는 그대로 두고 예약수량만 늘린다. */
    RESERVE("예약"),
    /** 예약 해제 */
    RELEASE("예약해제"),
    /** 출고. 현재고와 예약수량을 함께 줄인다. */
    SHIP("출고"),
    /** 입고. 현재고를 늘린다. */
    RECEIVE("입고");

    private final String label;
}
