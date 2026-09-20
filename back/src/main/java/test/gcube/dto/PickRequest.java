package test.gcube.dto;

import java.util.List;

/**
 * 시리얼 피킹 요청. 담당자가 출고할 개체를 직접 고를 때만 본문을 보낸다.
 *
 * @param serialNumbers 이 주문에 배정할 시리얼번호. 비우거나 본문을 보내지 않으면
 *                      서버가 보관 중인 개체를 시리얼번호 순으로 자동 배정한다.
 */
public record PickRequest(List<String> serialNumbers) {

    /** 본문은 있는데 목록만 빠진 요청도 자동 배정으로 본다. */
    @Override
    public List<String> serialNumbers() {
        return serialNumbers == null ? List.of() : serialNumbers;
    }
}
