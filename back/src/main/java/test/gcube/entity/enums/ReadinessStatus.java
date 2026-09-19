package test.gcube.entity.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 주문의 준비 가능 여부. (요구사항 3-3)
 * 저장하지 않고 판정할 때마다 계산하는 값이다.
 */
@Getter
@RequiredArgsConstructor
public enum ReadinessStatus {

    /** 현재고만으로 전량 준비된다. */
    READY("바로 준비 가능"),
    /** 검사가 끝나야 쓸 수 있는 입고예정을 기다린다. */
    WAIT_INSPECTION("품질검사 대기"),
    /** 생산이 끝나야 쓸 수 있는 입고예정을 기다린다. */
    WAIT_PRODUCTION("생산 완료 대기"),
    /** 구매 입고를 기다린다. */
    WAIT_PURCHASE("구매 입고 대기"),
    /** 입고예정까지 더해도 전량을 채울 수 없다. 발주 대상이다. */
    SHORTAGE("재고 부족"),
    /** 자동 처리하면 안 되는 주문. 담당자가 확인해야 한다. (요구사항 3-6) */
    REVIEW_REQUIRED("확인 필요");

    private final String label;

    /** 예약을 걸 수 있는 상태인지. 현재고로 전량 준비되는 주문만 예약한다. */
    public boolean isReservable() {
        return this == READY;
    }
}
