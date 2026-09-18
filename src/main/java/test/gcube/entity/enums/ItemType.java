package test.gcube.entity.enums;

import java.util.Arrays;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 품목 유형. item.type 에 이름 그대로 저장된다.
 *
 * <p>엑셀의 '세트상품'은 품목이 아니라 {@code item_set} 으로 분리했으므로 여기에 없다.
 */
@Getter
@RequiredArgsConstructor
public enum ItemType {

    /** 생산품 */
    MANUFACTURED("생산품"),
    /** 매입품 */
    PURCHASED("매입품"),
    /** 서비스. 설치·수거처럼 재고 수요가 생기지 않는 항목이다. */
    SERVICE("서비스");

    private final String label;

    public static ItemType ofLabel(String label) {
        return Arrays.stream(values())
                .filter(it -> it.label.equals(label))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("알 수 없는 품목 유형: " + label));
    }

    /** 재고를 차지하지 않는 유형인지 */
    public boolean isStockless() {
        return this == SERVICE;
    }
}
