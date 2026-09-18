package test.gcube.dto;

/**
 * 입고 처리 요청.
 *
 * @param quantity 이번에 입고할 수량. 누적 입고수량은 계획수량을 넘을 수 없다.
 */
public record ReceiptRequest(int quantity) {
}
