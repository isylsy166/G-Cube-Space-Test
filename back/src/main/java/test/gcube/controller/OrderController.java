package test.gcube.controller;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import test.gcube.dto.OrderDetailResponse;
import test.gcube.dto.OrderSummaryResponse;
import test.gcube.dto.PickRequest;
import test.gcube.dto.PickableUnitsResponse;
import test.gcube.entity.enums.OrderStatus;
import test.gcube.entity.enums.ReadinessStatus;
import test.gcube.dto.ScheduleCreateRequest;
import test.gcube.dto.StockScheduleResponse;
import test.gcube.service.OrderCommandService;
import test.gcube.service.OrderQueryService;
import test.gcube.service.ScheduleCommandService;

/** 주문 페이지 API. (요구사항 4-2) */
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderQueryService orderQueryService;
    private final OrderCommandService orderCommandService;
    private final ScheduleCommandService scheduleCommandService;

    /**
     * 배송예정일이 빠른 순, 같으면 접수일시가 빠른 순. 준비 판정 결과가 함께 붙는다.
     * 배송일·창고·준비상태로 걸러낼 수 있다. (요구사항 4-2)
     */
    @GetMapping
    public List<OrderSummaryResponse> findAll(
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) ReadinessStatus readiness,
            @RequestParam(required = false) String warehouseCode) {
        return orderQueryService.findAll(status, readiness, warehouseCode);
    }

    /** 주문 상세. 원 주문 라인과 세트 전개 후 실제 준비 품목을 함께 준다. */
    @GetMapping("/{orderNumber}")
    public OrderDetailResponse findByOrderNumber(@PathVariable String orderNumber) {
        return orderQueryService.findByOrderNumber(orderNumber);
    }

    /**
     * 재고 예약. 현재고만으로 전량 준비되는 주문만 예약할 수 있다.
     * 이미 예약된 주문에 다시 호출해도 예약수량은 늘지 않는다. (요구사항 3-4)
     */
    @PostMapping("/{orderNumber}/reservation")
    public OrderDetailResponse reserve(@PathVariable String orderNumber) {
        return orderCommandService.reserve(orderNumber);
    }

    /**
     * 시리얼 피킹. 예약된 시리얼 관리 품목에 실제 개체를 연결한다.
     *
     * <p>본문에 시리얼번호를 실어 보내면 그 개체만 배정한다(직접 선택).
     * 본문이 없으면 보관 중인 개체를 시리얼번호 순으로 자동 배정한다.
     */
    @PostMapping("/{orderNumber}/picking")
    public OrderDetailResponse pick(@PathVariable String orderNumber,
                                    @RequestBody(required = false) PickRequest request) {
        return orderCommandService.pick(orderNumber,
                request == null ? List.of() : request.serialNumbers());
    }

    /** 직접 선택용 후보 개체. 시리얼 품목마다 배정된 개체와 고를 수 있는 개체를 준다. */
    @GetMapping("/{orderNumber}/pickable-units")
    public List<PickableUnitsResponse> findPickableUnits(@PathVariable String orderNumber) {
        return orderQueryService.findPickableUnits(orderNumber);
    }

    /** 배정 해제. 잘못 고른 개체를 보관 중으로 되돌린다. 출고된 개체는 되돌리지 않는다. */
    @DeleteMapping("/{orderNumber}/picking/{serialNumber}")
    public OrderDetailResponse unpick(@PathVariable String orderNumber,
                                      @PathVariable String serialNumber) {
        return orderCommandService.unpick(orderNumber, serialNumber);
    }

    /** 출고. 현재고와 예약수량을 함께 줄인다. 이미 출고된 주문은 아무것도 바뀌지 않는다. */
    @PostMapping("/{orderNumber}/shipment")
    public OrderDetailResponse ship(@PathVariable String orderNumber) {
        return orderCommandService.ship(orderNumber);
    }

    /**
     * 부족 주문에서 바로 발주·생산의뢰를 만든다. 발주 페이지의 문서로 이어진다. (요구사항 4-4)
     *
     * @param idempotencyKey 같은 발주가 두 번 생기지 않게 하려면 넘긴다.
     */
    @PostMapping("/{orderNumber}/purchase-orders")
    public StockScheduleResponse createSchedule(
            @PathVariable String orderNumber,
            @RequestBody ScheduleCreateRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return scheduleCommandService.createFromOrder(orderNumber, request, idempotencyKey);
    }
}
