package test.gcube.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import test.gcube.entity.Item;
import test.gcube.entity.ItemSetComponent;
import test.gcube.entity.OrderDetail;
import test.gcube.repository.ItemSetComponentRepository;

/**
 * 주문 상세를 실제 준비해야 할 품목 수요로 전개한다. (요구사항 3-1)
 *
 * <p>규칙
 * <ul>
 *   <li>취소된 품목 라인은 기록만 남기고 준비 수량에서 뺀다.</li>
 *   <li>세트는 세트 자체가 아니라 구성품 수량으로 한 단계 전개한다.</li>
 *   <li>출고 대상이 아닌 구성품(설치·수거 서비스)은 수요에서 뺀다.</li>
 *   <li>재고로 관리하지 않는 서비스 품목은 단품으로 주문돼도 수요에서 뺀다.</li>
 *   <li>같은 품목이 일반 주문행과 세트 구성품에 함께 나오면 합산한다.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class SetExpander {

    private final ItemSetComponentRepository componentRepository;

    /** 여러 주문을 한 번에 전개할 때 세트 구성을 매번 다시 읽지 않도록 미리 받아 둔다. */
    public Map<Long, List<ItemSetComponent>> loadComponents(Collection<OrderDetail> details) {
        Set<Long> setIds = details.stream()
                .filter(OrderDetail::isSetOrder)
                .map(d -> d.getItemSet().getId())
                .collect(Collectors.toSet());
        if (setIds.isEmpty()) {
            return Map.of();
        }
        return componentRepository.findByItemSetIdInWithItem(setIds).stream()
                .collect(Collectors.groupingBy(c -> c.getItemSet().getId()));
    }

    public List<ItemDemand> expand(Collection<OrderDetail> details) {
        return expand(details, loadComponents(details));
    }

    /**
     * @param componentsBySet {@link #loadComponents} 로 미리 읽어 둔 세트 구성
     * @return 주문에 나온 순서대로 품목별 합산된 준비 수요
     */
    public List<ItemDemand> expand(Collection<OrderDetail> details,
                                   Map<Long, List<ItemSetComponent>> componentsBySet) {
        Map<String, int[]> quantityByCode = new LinkedHashMap<>();
        Map<String, Item> itemByCode = new LinkedHashMap<>();

        for (OrderDetail detail : details) {
            if (!detail.isPreparable()) {
                continue; // 취소된 라인은 준비 수량에서 뺀다
            }
            if (detail.isSetOrder()) {
                List<ItemSetComponent> components =
                        componentsBySet.getOrDefault(detail.getItemSet().getId(), List.of());
                for (ItemSetComponent component : components) {
                    if (!component.isShipping()) {
                        continue; // 출고 대상이 아닌 구성품은 재고 수요가 아니다
                    }
                    add(quantityByCode, itemByCode, component.getItem(),
                            component.getQuantity() * detail.getOrderQuantity());
                }
            } else {
                add(quantityByCode, itemByCode, detail.getItem(), detail.getOrderQuantity());
            }
        }

        List<ItemDemand> demands = new ArrayList<>(quantityByCode.size());
        quantityByCode.forEach((code, qty) -> demands.add(new ItemDemand(itemByCode.get(code), qty[0])));
        return demands;
    }

    private void add(Map<String, int[]> quantityByCode, Map<String, Item> itemByCode,
                     Item item, int quantity) {
        if (item.getType().isStockless()) {
            return; // 서비스 품목은 재고 수요를 만들지 않는다
        }
        itemByCode.putIfAbsent(item.getCode(), item);
        quantityByCode.computeIfAbsent(item.getCode(), code -> new int[1])[0] += quantity;
    }
}
