package test.gcube.controller;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import test.gcube.dto.StockScheduleResponse;
import test.gcube.entity.enums.ScheduleType;
import test.gcube.dto.InspectionRequest;
import test.gcube.dto.ReceiptRequest;
import test.gcube.dto.ScheduleDetailResponse;
import test.gcube.service.ScheduleCommandService;
import test.gcube.service.StockScheduleQueryService;

/** 발주 페이지 API. (요구사항 4-3) */
@RestController
@RequestMapping("/api/stock-schedules")
@RequiredArgsConstructor
public class StockScheduleController {

    private final StockScheduleQueryService stockScheduleQueryService;
    private final ScheduleCommandService scheduleCommandService;

    /** 구매발주·생산의뢰 문서 목록. 조건은 모두 선택이다. */
    @GetMapping
    public List<StockScheduleResponse> search(
            @RequestParam(required = false) ScheduleType type,
            @RequestParam(required = false) String warehouseCode,
            @RequestParam(required = false) String itemCode,
            @RequestParam(required = false) Boolean confirmed) {
        return stockScheduleQueryService.search(type, warehouseCode, itemCode, confirmed);
    }

    /** 문서 상세. 어떤 주문 때문에 생겼는지와 입고 이력을 함께 준다. */
    @GetMapping("/{code}")
    public ScheduleDetailResponse findByCode(@PathVariable String code) {
        return stockScheduleQueryService.findByCode(code);
    }

    /** 미확정 문서를 발주 확정으로 바꾼다. */
    @PostMapping("/{code}/confirmation")
    public StockScheduleResponse confirm(@PathVariable String code) {
        return scheduleCommandService.confirm(code);
    }

    /** 품질검사 결과 기록. 생산의뢰는 통과해야 입고할 수 있다. (요구사항 3-5) */
    @PostMapping("/{code}/inspection")
    public StockScheduleResponse inspect(@PathVariable String code,
                                         @RequestBody InspectionRequest request) {
        return scheduleCommandService.inspect(code, request);
    }

    /**
     * 입고 처리. 현재고가 늘고, 시리얼 관리 품목이면 개체가 그만큼 생긴다.
     * 계획수량을 넘는 입고는 거부된다.
     *
     * @param idempotencyKey 같은 입고가 두 번 반영되지 않게 하려면 넘긴다.
     */
    @PostMapping("/{code}/receipt")
    public StockScheduleResponse receive(
            @PathVariable String code,
            @RequestBody ReceiptRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return scheduleCommandService.receive(code, request, idempotencyKey);
    }
}
