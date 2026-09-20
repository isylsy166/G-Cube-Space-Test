package test.gcube.dto;

import java.util.List;

/**
 * 시리얼 관리 품목 한 개와 그 개체 전부. "어느 시리얼 제품이 어느 주문에 배정되었는가" 화면용.
 *
 * <p>품목별로 묶어서 내려 준다. 화면이 품목마다 상세를 부르면 요청이 품목 수만큼 늘고,
 * 품목 상세는 이 화면에 필요 없는 준비 판정까지 매번 다시 돌린다.
 */
public record ItemUnitGroupResponse(
        String itemCode,
        String itemName,
        List<ItemUnitResponse> units
) {
}
