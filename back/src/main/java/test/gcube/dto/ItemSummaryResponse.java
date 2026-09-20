package test.gcube.dto;

import java.util.List;
import test.gcube.entity.Item;
import test.gcube.entity.Stock;

/**
 * 품목 목록 한 줄. 수량 합계는 운영 중인 창고만 더한다.
 *
 * @param inactiveWarehouseQuantity 사용 중지된 창고에 남아 있는 현재고.
 *                                  준비 판단에는 쓰지 않지만 화면에서는 구분해 보여 준다.
 */
public record ItemSummaryResponse(
        String code,
        String name,
        String category,
        String type,
        String typeLabel,
        boolean serial,
        String spec,
        String supplierCode,
        String supplierName,
        int leadTimeDays,
        int quantity,
        int bookedQuantity,
        int availableQuantity,
        int inactiveWarehouseQuantity
) {
    public static ItemSummaryResponse of(Item item, List<Stock> stocks) {
        int quantity = 0;
        int booked = 0;
        int inactive = 0;
        for (Stock stock : stocks) {
            if (stock.getWarehouse().isActive()) {
                quantity += stock.getQuantity();
                booked += stock.getBookedQuantity();
            } else {
                inactive += stock.getQuantity();
            }
        }
        return new ItemSummaryResponse(
                item.getCode(),
                item.getName(),
                item.getCategory(),
                item.getType().name(),
                item.getType().getLabel(),
                item.isSerial(),
                item.getSpec(),
                item.getSupplier().getCode(),
                item.getSupplier().getName(),
                item.getSupplier().getLeadTimeDays(),
                quantity,
                booked,
                quantity - booked,
                inactive
        );
    }
}
