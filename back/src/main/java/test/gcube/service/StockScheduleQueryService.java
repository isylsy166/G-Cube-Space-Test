package test.gcube.service;

import java.util.List;
import java.util.NoSuchElementException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import test.gcube.dto.ScheduleDetailResponse;
import test.gcube.dto.StockLedgerResponse;
import test.gcube.dto.StockScheduleResponse;
import test.gcube.entity.enums.ScheduleType;
import test.gcube.repository.StockLedgerRepository;
import test.gcube.repository.StockScheduleRepository;

/** 발주 페이지(요구사항 4-3) 조회. 제공된 문서와 앱에서 만든 문서를 한 목록에서 본다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StockScheduleQueryService {

    private final StockScheduleRepository stockScheduleRepository;
    private final StockLedgerRepository stockLedgerRepository;

    public List<StockScheduleResponse> search(ScheduleType type, String warehouseCode,
                                              String itemCode, Boolean confirmed) {
        return stockScheduleRepository.search(type, warehouseCode, itemCode, confirmed).stream()
                .map(StockScheduleResponse::from)
                .toList();
    }

    public ScheduleDetailResponse findByCode(String code) {
        var schedule = stockScheduleRepository.findByCodeWithRefs(code)
                .orElseThrow(() -> new NoSuchElementException("없는 문서번호입니다: " + code));

        return new ScheduleDetailResponse(
                StockScheduleResponse.from(schedule),
                schedule.getOrder() == null ? null : schedule.getOrder().getOrderNumber(),
                stockLedgerRepository.findByScheduleIdWithRefs(schedule.getId()).stream()
                        .map(StockLedgerResponse::from).toList());
    }
}
