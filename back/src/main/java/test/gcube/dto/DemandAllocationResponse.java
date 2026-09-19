package test.gcube.dto;

import java.util.List;

/**
 * 준비 수요 한 줄의 판정 결과.
 *
 * @param availableQuantity  판정 시점에 이 주문이 쓸 수 있던 가용재고
 * @param fromStock          현재고에서 충당한 수량
 * @param fromSchedule       입고예정에서 충당한 수량
 * @param shortageQuantity   그래도 모자란 수량. 이 값이 발주 수량이 된다. (요구사항 3-5)
 * @param waitingScheduleCodes 기다리는 입고예정 문서번호
 */
public record DemandAllocationResponse(
        String itemCode,
        String itemName,
        String itemType,
        String itemTypeLabel,
        boolean serial,
        int requiredQuantity,
        int availableQuantity,
        int fromStock,
        int fromSchedule,
        int shortageQuantity,
        List<String> waitingScheduleCodes
) {
}
