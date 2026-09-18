package test.gcube.entity.enums;

import java.util.Arrays;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** 입고 예정 검사 상태. stock_schedule.inspect_status 에 이름 그대로 저장된다. */
@Getter
@RequiredArgsConstructor
public enum InspectStatus {

    /** 해당 없음. 검사 대상이 아닌 구매 건이다. */
    NOT_APPLICABLE("해당 없음"),
    /** 검사 전 */
    BEFORE_INSPECTION("검사 전"),
    /** 검사 대기. 아직 현재고가 아니다. */
    WAITING_INSPECTION("검사 대기"),
    /** 검사 완료 */
    INSPECTED("검사 완료");

    private final String label;

    public static InspectStatus ofLabel(String label) {
        return Arrays.stream(values())
                .filter(it -> it.label.equals(label))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("알 수 없는 검사 상태: " + label));
    }
}
