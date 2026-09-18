package test.gcube.api;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 조회 API 가 요구사항 3-1 / 3-2 / 3-3 / 3-6 을 지키는지 확인한다.
 * sample.sql 로 적재된 기준 데이터를 그대로 읽는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class QueryApiTest {

    @Autowired
    MockMvc mvc;

    // ---------- 제품 페이지 ----------

    @Test
    @DisplayName("품목 합계는 운영 중인 창고만 더하고, 사용 중지된 창고 수량은 따로 보여 준다")
    void itemSummarySeparatesInactiveWarehouse() throws Exception {
        mvc.perform(get("/api/items"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(14))
                // MAT-Z10-Q : WH-HQ 3(예약 1) + WH-LEGACY 5(사용 중지)
                .andExpect(jsonPath("$[?(@.code=='MAT-Z10-Q')].quantity").value(3))
                .andExpect(jsonPath("$[?(@.code=='MAT-Z10-Q')].bookedQuantity").value(1))
                .andExpect(jsonPath("$[?(@.code=='MAT-Z10-Q')].availableQuantity").value(2))
                .andExpect(jsonPath("$[?(@.code=='MAT-Z10-Q')].inactiveWarehouseQuantity").value(5));
    }

    @Test
    @DisplayName("품목 상세는 창고별 재고, 시리얼 개체, 걸려 있는 입고예정을 함께 준다")
    void itemDetail() throws Exception {
        mvc.perform(get("/api/items/{code}", "MAT-Z10-Q"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.item.serial").value(true))
                .andExpect(jsonPath("$.stocks.length()").value(2))
                .andExpect(jsonPath("$.stocks[?(@.warehouseCode=='WH-LEGACY')].active").value(false))
                // WH-HQ 4개 + 사용 중지된 WH-LEGACY 5개
                .andExpect(jsonPath("$.units.length()").value(9))
                .andExpect(jsonPath("$.units[?(@.warehouseCode=='WH-HQ')]", hasSize(4)))
                .andExpect(jsonPath("$.units[?(@.serialNumber=='UNIT-Z10-Q-0000')].onHand").value(false))
                .andExpect(jsonPath("$.units[?(@.serialNumber=='UNIT-Z10-Q-0003')].statusLabel")
                        .value("주문 배정됨"))
                .andExpect(jsonPath("$.units[?(@.serialNumber=='UNIT-Z10-Q-0000')].assignedOrderNumber")
                        .value("ORD202607180014"))
                .andExpect(jsonPath("$.schedules.length()").value(2));
    }

    @Test
    @DisplayName("시리얼 관리 품목이 아니면 개체 목록은 비어 있다")
    void nonSerialItemHasNoUnits() throws Exception {
        mvc.perform(get("/api/items/{code}", "PIL-ZERO"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.item.serial").value(false))
                .andExpect(jsonPath("$.units.length()").value(0));
    }

    @Test
    @DisplayName("등록되지 않은 품목은 404 와 한글 사유를 준다")
    void unknownItemReturns404() throws Exception {
        mvc.perform(get("/api/items/{code}", "UNKNOWN-SKU"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("등록되지 않은 품목입니다: UNKNOWN-SKU"));
    }

    // ---------- 주문 페이지 ----------

    @Test
    @DisplayName("주문 목록은 배송예정일, 같으면 접수일시가 빠른 순이다")
    void ordersAreSortedByDeliveryThenCreated() throws Exception {
        mvc.perform(get("/api/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(29))
                .andExpect(jsonPath("$[0].orderNumber").value("ORD202607180014"))
                .andExpect(jsonPath("$[0].deliveryAt").value("2026-07-22T00:00:00"));
    }

    @Test
    @DisplayName("세트는 구성품으로 전개되고 설치·수거 서비스는 준비 수량에서 빠진다")
    void setIsExpandedAndServicesExcluded() throws Exception {
        // SET-Z10-DMN-K = 매트리스 + 프레임 + 커버 + 설치 + 수거
        mvc.perform(get("/api/orders/{orderNumber}", "ORD202607200016"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lines.length()").value(1))
                .andExpect(jsonPath("$.lines[0].kind").value("SET"))
                .andExpect(jsonPath("$.readiness.demands.length()").value(3))
                .andExpect(jsonPath("$.readiness.demands[?(@.itemCode=='MAT-Z10-K')].requiredQuantity").value(1))
                .andExpect(jsonPath("$.readiness.demands[?(@.itemCode=='FRM-DMN-K')].requiredQuantity").value(1))
                .andExpect(jsonPath("$.readiness.demands[?(@.itemCode=='CVR-WP-K')].requiredQuantity").value(1))
                .andExpect(jsonPath("$.readiness.demands[?(@.itemCode=='SVC-INSTALL')]").isEmpty());
    }

    @Test
    @DisplayName("단품으로 주문된 서비스 항목도 준비 수량에서 빠진다")
    void serviceOrderedAloneIsExcluded() throws Exception {
        // 1번 라인 SET-Z10-DMN-Q, 2번 라인 SVC-DISPOSAL
        mvc.perform(get("/api/orders/{orderNumber}", "ORD202607210029"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lines.length()").value(2))
                .andExpect(jsonPath("$.readiness.demands.length()").value(2))
                .andExpect(jsonPath("$.readiness.demands[?(@.itemCode=='MAT-Z10-Q')].requiredQuantity").value(1))
                .andExpect(jsonPath("$.readiness.demands[?(@.itemCode=='FRM-DMN-Q')].requiredQuantity").value(1));
    }

    @Test
    @DisplayName("취소된 주문은 준비 수요를 만들지 않고 사유를 보여 준다")
    void canceledOrderProducesNoDemand() throws Exception {
        mvc.perform(get("/api/orders/{orderNumber}", "ORD202607190004"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.preparationTarget").value(false))
                .andExpect(jsonPath("$.readiness.demands.length()").value(0))
                .andExpect(jsonPath("$.readiness.reviewReasons.length()").value(1));
    }

    @Test
    @DisplayName("출고 완료, 배송 완료 주문도 새 준비 대상이 아니다")
    void finishedOrdersAreNotPreparationTargets() throws Exception {
        mvc.perform(get("/api/orders/{orderNumber}", "ORD202607190013"))
                .andExpect(jsonPath("$.order.preparationTarget").value(false))
                .andExpect(jsonPath("$.readiness.demands.length()").value(0));
        mvc.perform(get("/api/orders/{orderNumber}", "ORD202607180014"))
                .andExpect(jsonPath("$.order.preparationTarget").value(false))
                .andExpect(jsonPath("$.readiness.demands.length()").value(0));
    }

    @Test
    @DisplayName("수량이 잘못된 주문은 확인 사유가 붙는다")
    void invalidQuantityIsFlagged() throws Exception {
        mvc.perform(get("/api/orders/{orderNumber}", "ORD202607200026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readiness.reviewReasons.length()").value(1))
                .andExpect(jsonPath("$.readiness.reviewReasons[0]")
                        .value("1번 품목의 주문 수량이 0 입니다. 수량 확인이 필요합니다."));
    }

    @Test
    @DisplayName("상태로 주문을 걸러낼 수 있다")
    void ordersCanBeFilteredByStatus() throws Exception {
        mvc.perform(get("/api/orders").param("status", "CONFIRMED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(26));
    }

    // ---------- 발주 페이지 ----------

    @Test
    @DisplayName("입고예정 목록은 남은수량을 계산하고 준비 판단에 쓸 수 있는지 표시한다")
    void schedulesExposeRemainingAndUsability() throws Exception {
        mvc.perform(get("/api/stock-schedules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(12))
                // 부분 입고: 계획 3 - 입고 1 = 2
                .andExpect(jsonPath("$[?(@.code=='PO-20260719-DMN')].remainingQuantity").value(2))
                .andExpect(jsonPath("$[?(@.code=='PO-20260719-DMN')].usableForPlanning").value(true))
                // 미확정 문서는 준비 판단에 쓰지 않는다
                .andExpect(jsonPath("$[?(@.code=='PO-20260721-PIL')].confirmed").value(false))
                .andExpect(jsonPath("$[?(@.code=='PO-20260721-PIL')].usableForPlanning").value(false))
                // 사용 중지된 창고로 들어오는 문서도 쓰지 않는다
                .andExpect(jsonPath("$[?(@.code=='PO-LEGACY-Z10')].warehouseActive").value(false))
                .andExpect(jsonPath("$[?(@.code=='PO-LEGACY-Z10')].usableForPlanning").value(false))
                // 이미 전량 입고된 문서는 남은 수량이 없다
                .andExpect(jsonPath("$[?(@.code=='PO-20260718-CVRK')].remainingQuantity").value(0))
                .andExpect(jsonPath("$[?(@.code=='PO-20260718-CVRK')].usableForPlanning").value(false));
    }

    @Test
    @DisplayName("문서구분과 창고로 목록을 걸러낼 수 있다")
    void schedulesCanBeFiltered() throws Exception {
        mvc.perform(get("/api/stock-schedules").param("type", "PRODUCTION"))
                .andExpect(jsonPath("$.length()").value(5));
        mvc.perform(get("/api/stock-schedules").param("type", "PURCHASE"))
                .andExpect(jsonPath("$.length()").value(7));
        mvc.perform(get("/api/stock-schedules").param("confirmed", "true"))
                .andExpect(jsonPath("$.length()").value(10));
        mvc.perform(get("/api/stock-schedules").param("warehouseCode", "WH-CJ"))
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    @DisplayName("생산의뢰는 검사 상태를 함께 보여 준다")
    void productionScheduleShowsInspectStatus() throws Exception {
        mvc.perform(get("/api/stock-schedules/{code}", "MO-20260721-Z10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schedule.typeLabel").value("생산"))
                .andExpect(jsonPath("$.schedule.inspectStatus").value("WAITING_INSPECTION"))
                .andExpect(jsonPath("$.schedule.inspectStatusLabel").value("검사 대기"))
                .andExpect(jsonPath("$.schedule.supplierCode").value("FAC-01"))
                .andExpect(jsonPath("$.schedule.leadTimeDays").value(3))
                // 제공된 기존 문서는 만들어 준 주문이 없다
                .andExpect(jsonPath("$.sourceOrderNumber").doesNotExist())
                .andExpect(jsonPath("$.ledgers.length()").value(0));
    }
}
