package test.gcube.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import test.gcube.entity.Orders;
import test.gcube.entity.Stock;
import test.gcube.entity.StockLedger;
import test.gcube.entity.StockSchedule;
import test.gcube.entity.enums.LedgerType;
import test.gcube.repository.StockLedgerRepository;

/**
 * 재고를 바꾼 직후 이력을 남긴다.
 * 변화 후 값은 {@link Stock} 에서 읽으므로 반드시 수량을 바꾼 뒤에 호출해야 한다.
 */
@Component
@RequiredArgsConstructor
public class StockLedgerRecorder {

    private final StockLedgerRepository stockLedgerRepository;

    public void record(Stock stock, Orders order, StockSchedule schedule, LedgerType type,
                       int quantityDelta, int bookedDelta, String memo) {
        stockLedgerRepository.save(StockLedger.builder()
                .stock(stock)
                .order(order)
                .stockSchedule(schedule)
                .type(type)
                .quantityDelta(quantityDelta)
                .bookedDelta(bookedDelta)
                .memo(memo)
                .build());
    }
}
