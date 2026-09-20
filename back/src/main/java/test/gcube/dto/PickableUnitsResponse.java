package test.gcube.dto;

import java.util.List;

/**
 * 직접 선택 화면용. 시리얼 관리 품목의 예약 한 건에 대해
 * 이미 배정된 개체와 아직 고를 수 있는 개체를 함께 준다. (요구사항 4-2)
 *
 * @param reservedQuantity  이 품목으로 예약된 수량. 배정은 이 수량을 넘을 수 없다.
 * @param assignedQuantity  이미 이 주문에 배정된 개체 수
 * @param remainingQuantity 더 골라야 하는 개체 수
 * @param assignedUnits     이미 배정된 개체
 * @param candidates        같은 창고에 보관 중이고 아직 어느 주문에도 배정되지 않은 개체
 */
public record PickableUnitsResponse(
        String itemCode,
        String itemName,
        String warehouseCode,
        int reservedQuantity,
        int assignedQuantity,
        int remainingQuantity,
        List<ItemUnitResponse> assignedUnits,
        List<ItemUnitResponse> candidates
) {
}
