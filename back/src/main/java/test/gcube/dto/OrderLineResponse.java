package test.gcube.dto;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import test.gcube.entity.ItemSetComponent;
import test.gcube.entity.OrderDetail;

/**
 * 주문에 원래 적힌 그대로의 한 줄. 세트 주문이면 kind 가 SET 이다.
 *
 * @param components   세트 주문이면 구성품, 단품이면 빈 목록.
 *                     준비 수량에 들어가는 구성품이 먼저 오고 제외되는 항목이 뒤에 온다.
 * @param unregistered 품목으로 등록되지 않은 라인인지. 이때 code 는 주문서에 적혀 있던
 *                     원본 코드이고, 담당자는 이 코드를 품목으로 등록해야 한다. (요구사항 3-6)
 */
public record OrderLineResponse(
        int sequence,
        String kind,
        String code,
        String name,
        int orderQuantity,
        String status,
        String statusLabel,
        List<SetComponentResponse> components,
        boolean unregistered
) {
    /** @param componentsBySet 세트 아이디별 구성품. {@code SetExpander.loadComponents} 결과를 그대로 쓴다. */
    public static OrderLineResponse from(OrderDetail detail,
                                         Map<Long, List<ItemSetComponent>> componentsBySet) {
        boolean set = detail.isSetOrder();
        boolean unregistered = detail.isUnregistered();
        return new OrderLineResponse(
                detail.getSequence(),
                unregistered ? "UNREGISTERED" : set ? "SET" : "ITEM",
                unregistered ? detail.getRawItemCode()
                        : set ? detail.getItemSet().getCode() : detail.getItem().getCode(),
                unregistered ? "등록되지 않은 품목"
                        : set ? detail.getItemSet().getName() : detail.getItem().getName(),
                detail.getOrderQuantity(),
                detail.getStatus().name(),
                detail.getStatus().getLabel(),
                set ? components(detail, componentsBySet) : List.of(),
                unregistered);
    }

    private static List<SetComponentResponse> components(
            OrderDetail detail, Map<Long, List<ItemSetComponent>> componentsBySet) {
        return componentsBySet.getOrDefault(detail.getItemSet().getId(), List.of()).stream()
                .map(c -> SetComponentResponse.of(c, detail.getOrderQuantity()))
                // 실제 준비 대상이 위, 제외되는 항목이 아래. 같은 그룹 안에서는 품목코드 순.
                .sorted(Comparator.comparing(SetComponentResponse::stockDemand).reversed()
                        .thenComparing(SetComponentResponse::itemCode))
                .toList();
    }
}
