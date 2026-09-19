package test.gcube.dto;

/**
 * 품질검사 결과 기록. 생산의뢰는 통과해야 입고할 수 있다. (요구사항 3-5)
 *
 * @param passed 검사 통과 여부
 */
public record InspectionRequest(boolean passed) {
}
