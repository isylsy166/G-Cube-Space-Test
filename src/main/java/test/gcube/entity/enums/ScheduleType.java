package test.gcube.entity.enums;

import java.util.Arrays;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** 입고 예정 문서 구분. stock_schedule.type 에 이름 그대로 저장된다. */
@Getter
@RequiredArgsConstructor
public enum ScheduleType {

    /** 구매발주 */
    PURCHASE("구매"),
    /** 생산의뢰 */
    PRODUCTION("생산");

    private final String label;

    public static ScheduleType ofLabel(String label) {
        return Arrays.stream(values())
                .filter(it -> it.label.equals(label))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("알 수 없는 문서 구분: " + label));
    }
}
