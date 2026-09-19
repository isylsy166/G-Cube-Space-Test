package test.gcube.entity.enums;

import java.util.Arrays;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** 입고 예정 진행 상태. stock_schedule.status 에 이름 그대로 저장된다. */
@Getter
@RequiredArgsConstructor
public enum ScheduleStatus {

    /** 작성 중. 아직 확정되지 않아 들어올 수량으로 보지 않는다. */
    DRAFT("작성 중"),
    /** 발주 확정 */
    CONFIRMED("발주 확정"),
    /** 진행 중 */
    IN_PROGRESS("진행 중"),
    /** 생산 완료 */
    PRODUCED("생산 완료"),
    /** 검사 완료 */
    INSPECTED("검사 완료"),
    /** 부분 입고 */
    PARTIAL_RECEIVED("부분 입고"),
    /** 입고 완료 */
    RECEIVED("입고 완료");

    private final String label;

    public static ScheduleStatus ofLabel(String label) {
        return Arrays.stream(values())
                .filter(it -> it.label.equals(label))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("알 수 없는 진행 상태: " + label));
    }
}
