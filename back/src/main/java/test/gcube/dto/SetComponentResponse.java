package test.gcube.dto;

import test.gcube.entity.ItemSetComponent;

/**
 * 세트 주문 한 줄을 펼친 구성품. 주문 화면에서 "주문한 품목"과
 * "준비해야 할 품목"이 어떻게 이어지는지 보여 준다. (요구사항 4-2)
 *
 * @param quantityPerSet  세트 1개당 구성 수량
 * @param requiredQuantity 이 주문 라인에서 실제로 필요한 수량 (세트당 수량 × 주문 수량)
 * @param stockDemand     재고 수요를 만드는 구성품인지.
 *                        {@code false} 면 {@link #excludeReason} 에 한글 사유가 담긴다.
 */
public record SetComponentResponse(
        String itemCode,
        String itemName,
        String typeLabel,
        boolean serial,
        int quantityPerSet,
        int requiredQuantity,
        boolean stockDemand,
        String excludeReason
) {
    /**
     * 제외 판정은 {@code SetExpander.expand} 와 같은 순서로 본다.
     * 출고 대상이 아닌 구성품을 먼저 걸러내고, 그 다음 서비스 품목을 걸러낸다.
     * 둘 중 하나라도 걸리면 준비 수량에 들어가지 않는다. (요구사항 3-1)
     */
    public static SetComponentResponse of(ItemSetComponent component, int orderQuantity) {
        String excludeReason = null;
        if (!component.isShipping()) {
            excludeReason = "출고 대상이 아닌 구성품이라 준비 수량에서 제외됩니다.";
        } else if (component.getItem().getType().isStockless()) {
            excludeReason = "재고로 관리하지 않는 서비스라 준비 수량에서 제외됩니다.";
        }

        return new SetComponentResponse(
                component.getItem().getCode(),
                component.getItem().getName(),
                component.getItem().getType().getLabel(),
                component.getItem().isSerial(),
                component.getQuantity(),
                component.getQuantity() * orderQuantity,
                excludeReason == null,
                excludeReason);
    }
}
