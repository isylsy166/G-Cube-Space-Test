package test.gcube.dto;

/**
 * 품질검사 결과 기록. 생산의뢰는 통과한 수량만 입고할 수 있다. (요구사항 3-5)
 *
 * <p>검사는 전량 합격/전량 불합격이 아니다. 생산 물량 중 일부만 합격하는 것이 오히려 흔해서
 * 통과 수량을 받는다. {@code passedQuantity} 가 0 이면 전량 불합격이다.
 *
 * @param passedQuantity 검사를 통과한 수량. 비워 두면 전량 통과로 본다.
 * @param passed         (구버전 호환) 전량 통과 여부. {@code passedQuantity} 가 있으면 무시한다.
 */
public record InspectionRequest(Integer passedQuantity, Boolean passed) {

    /** 실제로 기록할 통과 수량. 수량을 주지 않았으면 합격=전량, 불합격=0 으로 읽는다. */
    public int resolvePassedQuantity(int planQuantity) {
        if (passedQuantity != null) {
            return passedQuantity;
        }
        return Boolean.FALSE.equals(passed) ? 0 : planQuantity;
    }
}
