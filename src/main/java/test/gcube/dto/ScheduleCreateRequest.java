package test.gcube.dto;

/**
 * 부족 주문에서 넘어와 발주·생산의뢰를 만드는 요청. (요구사항 3-5)
 *
 * <p>품목유형이 매입품이면 구매발주, 생산품이면 생산의뢰로 자동 결정한다.
 * 입고창고는 그 주문의 출고창고여야 하므로 요청에서 받지 않는다.
 *
 * @param itemCode     부족한 품목
 * @param quantity     발주 수량. 비우면 판정이 계산한 부족수량을 그대로 쓴다.
 * @param supplierCode 공급처. 비우면 품목의 기본 공급처를 쓴다.
 */
public record ScheduleCreateRequest(
        String itemCode,
        Integer quantity,
        String supplierCode
) {
}
