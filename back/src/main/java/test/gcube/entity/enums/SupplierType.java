package test.gcube.entity.enums;

import java.util.Arrays;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** 공급처 구분. supplier.type 에 이름 그대로 저장된다. */
@Getter
@RequiredArgsConstructor
public enum SupplierType {

    /** 구매처 */
    PURCHASE("구매처"),
    /** 생산처 */
    PRODUCTION("생산처"),
    /**
     * 자사. 원본 데이터에는 없는 값으로, 공급처가 없는 서비스 품목을 묶기 위해 둔다.
     */
    INHOUSE("자사");

    private final String label;

    /** 엑셀 원문(한글)으로 찾는다. */
    public static SupplierType ofLabel(String label) {
        return Arrays.stream(values())
                .filter(it -> it.label.equals(label))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("알 수 없는 공급처 구분: " + label));
    }
}
