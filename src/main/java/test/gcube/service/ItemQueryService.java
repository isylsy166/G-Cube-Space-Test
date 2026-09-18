package test.gcube.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import test.gcube.dto.ItemDetailResponse;
import test.gcube.dto.ItemSummaryResponse;
import test.gcube.dto.ItemUnitResponse;
import test.gcube.dto.OrderReadinessResponse;
import test.gcube.dto.StockLedgerResponse;
import test.gcube.dto.StockScheduleResponse;
import test.gcube.dto.WaitingOrderResponse;
import test.gcube.dto.WarehouseStockResponse;
import test.gcube.entity.Item;
import test.gcube.entity.Stock;
import test.gcube.repository.ItemRepository;
import test.gcube.repository.ItemUnitRepository;
import test.gcube.repository.StockRepository;
import test.gcube.repository.StockLedgerRepository;
import test.gcube.repository.StockScheduleRepository;

/** 제품 페이지(요구사항 4-1) 조회. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ItemQueryService {

    private final ItemRepository itemRepository;
    private final StockRepository stockRepository;
    private final ItemUnitRepository itemUnitRepository;
    private final StockScheduleRepository stockScheduleRepository;
    private final StockLedgerRepository stockLedgerRepository;
    private final ReadinessPlanner readinessPlanner;

    public List<ItemSummaryResponse> findAll() {
        Map<Long, List<Stock>> stocksByItem = stockRepository.findAllWithRefs().stream()
                .collect(Collectors.groupingBy(s -> s.getItem().getId()));

        return itemRepository.findAllWithSupplier().stream()
                .map(item -> ItemSummaryResponse.of(
                        item, stocksByItem.getOrDefault(item.getId(), List.of())))
                .toList();
    }

    public ItemDetailResponse findByCode(String code) {
        Item item = itemRepository.findByCodeWithSupplier(code)
                .orElseThrow(() -> new NoSuchElementException("등록되지 않은 품목입니다: " + code));

        List<Stock> stocks = stockRepository.findByItemIdWithWarehouse(item.getId());

        return new ItemDetailResponse(
                ItemSummaryResponse.of(item, stocks),
                stocks.stream().map(WarehouseStockResponse::from).toList(),
                item.isSerial()
                        ? itemUnitRepository.findByItemIdWithRefs(item.getId()).stream()
                                .map(ItemUnitResponse::from).toList()
                        : List.of(),
                waitingOrders(code),
                stockScheduleRepository.findByItemIdWithRefs(item.getId()).stream()
                        .map(StockScheduleResponse::from).toList(),
                stockLedgerRepository.findByItemIdWithRefs(item.getId()).stream()
                        .map(StockLedgerResponse::from).toList());
    }

    /** 이 품목이 준비 수요에 들어 있는 주문. 부족한 주문이 먼저 온다. */
    private List<WaitingOrderResponse> waitingOrders(String itemCode) {
        List<WaitingOrderResponse> waiting = new ArrayList<>();
        for (OrderReadinessResponse readiness : readinessPlanner.planAll().values()) {
            readiness.demands().stream()
                    .filter(d -> d.itemCode().equals(itemCode))
                    .forEach(d -> waiting.add(new WaitingOrderResponse(
                            readiness.orderNumber(),
                            readiness.warehouseCode(),
                            readiness.deliveryAt(),
                            readiness.status(),
                            readiness.statusLabel(),
                            d.requiredQuantity(),
                            d.shortageQuantity())));
        }
        waiting.sort(Comparator.comparingInt(WaitingOrderResponse::shortageQuantity).reversed());
        return waiting;
    }
}
