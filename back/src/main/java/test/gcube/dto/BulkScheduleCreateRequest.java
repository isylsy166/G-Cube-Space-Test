package test.gcube.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * 부족 수량을 여러 주문에 걸쳐 한 번에 묶어 발주한다. (요구사항 4-5 선택 사항)
 *
 * <p>같은 품목을 서로 다른 주문이 조금씩 부족해하는 상황이 흔하다. 주문마다 따로 발주하면
 * 공급처에 작은 발주가 여러 건 나가고, 담당자는 어느 문서가 어느 주문 것인지 세야 한다.
 * 그래서 <b>같은 품목·같은 입고창고</b>의 부족분을 한 문서로 합친다.
 *
 * <p>입고창고는 주문의 출고창고여야 하므로, 창고가 다른 주문끼리는 묶을 수 없다.
 * 묶은 문서는 대표 주문 하나에 연결하고 나머지 주문은 사유에 남긴다.
 *
 * @param orderNumbers 묶을 주문. 모두 같은 출고창고여야 한다.
 * @param itemCode     부족한 품목
 * @param quantity     발주 수량. 비우면 각 주문의 부족수량을 합한 값을 쓴다.
 * @param supplierCode 공급처. 비우면 품목의 기본 공급처를 쓴다.
 * @param availableAt  사용 가능 예정일. 비우면 `기준시각 + 공급처 리드타임`.
 */
public record BulkScheduleCreateRequest(
        List<String> orderNumbers,
        String itemCode,
        Integer quantity,
        String supplierCode,
        LocalDate availableAt
) {
}
