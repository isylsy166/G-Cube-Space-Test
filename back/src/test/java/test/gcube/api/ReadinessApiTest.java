package test.gcube.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.jdbc.Sql;
import test.gcube.support.MySqlTestContainer;

/**
 * 준비 가능 여부 판정. 요구사항 5의 시나리오 1~5 를 확인한다.
 * 판정은 읽기만 하므로 데이터를 바꾸지 않는다.
 */
@SpringBootTest
@Import(MySqlTestContainer.class)
@AutoConfigureMockMvc
// 테스트마다 기준 데이터를 다시 적재한다. 개발용 MySQL 은 실행 중인 앱과
// 공유하므로, 앞선 실행이나 브라우저가 남긴 상태에 기대지 않는다.
@Sql("classpath:schema/sample.sql")
class ReadinessApiTest {

    @Autowired
    MockMvc mvc;

    @Test
    @DisplayName("시나리오 1 - 세트 1개가 구성품으로 전개되고 설치·수거 서비스는 수요에서 빠진다")
    void scenario1_setExpansion() throws Exception {
        mvc.perform(get("/api/orders/{no}", "ORD202607200016"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lines.length()").value(1))
                .andExpect(jsonPath("$.readiness.demands.length()").value(3))
                .andExpect(jsonPath("$.readiness.statusLabel").value("바로 준비 가능"));
    }

    @Test
    @DisplayName("시나리오 2 - 취소 품목은 준비 수량에서 빠진다")
    void scenario2_canceledLineExcluded() throws Exception {
        // 순번 2 CVR-WP-Q 1개(정상) + 순번 3 CVR-WP-Q 2개(취소) → 필요수량은 1
        mvc.perform(get("/api/orders/{no}", "ORD202607200003"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lines.length()").value(3))
                .andExpect(jsonPath("$.lines[2].statusLabel").value("취소"))
                .andExpect(jsonPath("$.readiness.demands.length()").value(2))
                .andExpect(jsonPath("$.readiness.demands[?(@.itemCode=='CVR-WP-Q')].requiredQuantity")
                        .value(1));
    }

    @Test
    @DisplayName("시나리오 2 - 취소·출고완료·배송완료 주문은 판정 대상이 아니다")
    void scenario2_finishedOrdersExcluded() throws Exception {
        for (String orderNumber : new String[]{"ORD202607190004", "ORD202607190013", "ORD202607180014"}) {
            mvc.perform(get("/api/orders/{no}", orderNumber))
                    .andExpect(jsonPath("$.order.preparationTarget").value(false))
                    // 사람이 손봐야 하는 '확인 필요' 와 구분한다. 이미 끝난 주문이다
                    .andExpect(jsonPath("$.readiness.status").value("NOT_APPLICABLE"))
                    .andExpect(jsonPath("$.readiness.statusLabel").value("준비 대상 아님"))
                    .andExpect(jsonPath("$.readiness.demands.length()").value(0));
        }
    }

    @Test
    @DisplayName("시나리오 3 - 현재고로 되는 주문과 검사·생산·구매를 기다리는 주문이 구분된다")
    void scenario3_waitCausesAreDistinguished() throws Exception {
        mvc.perform(get("/api/orders/{no}", "ORD202607200001"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("바로 준비 가능"))
                .andExpect(jsonPath("$.readiness.demands[0].fromStock").value(1))
                .andExpect(jsonPath("$.readiness.demands[0].fromSchedule").value(0));

        // 검사 대기인 생산 문서를 기다린다
        mvc.perform(get("/api/orders/{no}", "ORD202607200007"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("품질검사 대기"))
                .andExpect(jsonPath("$.readiness.demands[0].fromSchedule").value(1))
                .andExpect(jsonPath("$.readiness.demands[0].waitingScheduleCodes[0]")
                        .value("MO-20260721-Z10"));

        // 아직 생산 중인 문서를 기다린다
        mvc.perform(get("/api/orders/{no}", "ORD202607200008"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("생산 완료 대기"))
                .andExpect(jsonPath("$.readiness.demands[0].waitingScheduleCodes[0]")
                        .value("MO-20260722-V3"));

        // 구매 입고를 기다린다
        mvc.perform(get("/api/orders/{no}", "ORD202607200019"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("구매 입고 대기"))
                .andExpect(jsonPath("$.readiness.demands[0].fromStock").value(2))
                .andExpect(jsonPath("$.readiness.demands[0].fromSchedule").value(1));
    }

    @Test
    @DisplayName("시나리오 4 - 다품목 주문에서 한 품목만 부족해도 전체가 재고 부족이다")
    void scenario4_partialAllocationIsNotAllowed() throws Exception {
        // MAT-V3-Q 는 부족하지만 CVR-WP-Q 는 남아 있다
        mvc.perform(get("/api/orders/{no}", "ORD202607200015"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("재고 부족"))
                .andExpect(jsonPath("$.readiness.demands[?(@.itemCode=='MAT-V3-Q')].shortageQuantity")
                        .value(1))
                .andExpect(jsonPath("$.readiness.demands[?(@.itemCode=='CVR-WP-Q')].shortageQuantity")
                        .value(0))
                // 부족 주문은 예약을 걸지 않았으므로 잡아둔 재고가 없다
                .andExpect(jsonPath("$.reservations.length()").value(0));
    }

    @Test
    @DisplayName("시나리오 5 - 사용 중지된 창고 주문은 재고를 바꾸지 않고 사유를 보여 준다")
    void scenario5_inactiveWarehouse() throws Exception {
        mvc.perform(get("/api/orders/{no}", "ORD202607200010"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("확인 필요"))
                .andExpect(jsonPath("$.readiness.reviewReasons[0]")
                        .value("출고창고 WH-LEGACY 가 사용 중지 상태입니다. 창고 확인이 필요합니다."))
                .andExpect(jsonPath("$.readiness.demands.length()").value(0));
    }

    @Test
    @DisplayName("시나리오 5 - 미등록 품목 주문과 잘못된 수량 주문도 확인 필요로 빠진다")
    void scenario5_unknownItemAndBadQuantity() throws Exception {
        // 어느 코드가 문제인지 그대로 보여 준다. 담당자는 이 코드를 품목으로 등록해야 한다
        mvc.perform(get("/api/orders/{no}", "ORD202607200011"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("확인 필요"))
                .andExpect(jsonPath("$.readiness.reviewReasons[0]")
                        .value("1번 품목 'UNKNOWN-SKU' 가 품목으로 등록되어 있지 않습니다. 품목 등록 후 다시 확인해 주세요."))
                // 원본 코드가 주문 라인에도 남아 있다
                .andExpect(jsonPath("$.lines[0].unregistered").value(true))
                .andExpect(jsonPath("$.lines[0].code").value("UNKNOWN-SKU"));

        mvc.perform(get("/api/orders/{no}", "ORD202607200026"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("확인 필요"))
                .andExpect(jsonPath("$.readiness.reviewReasons[0]")
                        .value("1번 품목의 주문 수량이 0 입니다. 수량 확인이 필요합니다."));
    }

    @Test
    @DisplayName("앞선 주문이 가져간 재고를 뒤 주문이 다시 쓰지 못한다")
    void earlierOrdersConsumeStockFirst() throws Exception {
        // WH-08 PIL-ZERO 가용 8. 배송 07-22 주문이 4를 가져가고, 07-23 주문은 5가 필요해 1 부족.
        mvc.perform(get("/api/orders/{no}", "ORD202607200009"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("바로 준비 가능"))
                .andExpect(jsonPath("$.readiness.demands[0].availableQuantity").value(8));

        mvc.perform(get("/api/orders/{no}", "ORD202607200012"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("재고 부족"))
                .andExpect(jsonPath("$.readiness.demands[0].availableQuantity").value(4))
                .andExpect(jsonPath("$.readiness.demands[0].shortageQuantity").value(1));
    }

    @Test
    @DisplayName("사용 중지된 창고의 재고와 입고예정은 판정에 쓰이지 않는다")
    void inactiveWarehouseStockIsIgnored() throws Exception {
        // WH-LEGACY 에 MAT-Z10-Q 가 5개, PO-LEGACY-Z10 이 10개 걸려 있지만 어디에도 쓰이지 않는다
        mvc.perform(get("/api/items/{code}", "MAT-Z10-Q"))
                .andExpect(jsonPath("$.item.inactiveWarehouseQuantity").value(5))
                .andExpect(jsonPath("$.schedules[?(@.code=='PO-LEGACY-Z10')].usableForPlanning")
                        .value(false));

        // WH-HQ 재고가 다 나간 뒤의 주문은 검사 대기 문서를 기다린다 (구창고 재고를 끌어오지 않는다)
        mvc.perform(get("/api/orders/{no}", "ORD202607200007"))
                .andExpect(jsonPath("$.readiness.demands[0].availableQuantity").value(0))
                .andExpect(jsonPath("$.readiness.statusLabel").value("품질검사 대기"));
    }

    @Test
    @DisplayName("배송일 전날까지 쓸 수 없는 입고예정은 고려하지 않는다")
    void schedulesArrivingTooLateAreIgnored() throws Exception {
        // MO-20260721-Z10 은 07-22 사용 가능. 배송 07-22 주문에는 못 쓰고 07-23 주문에는 쓸 수 있다.
        mvc.perform(get("/api/orders/{no}", "ORD202607200007"))   // 배송 07-23
                .andExpect(jsonPath("$.readiness.demands[0].waitingScheduleCodes[0]")
                        .value("MO-20260721-Z10"));

        // 배송 07-27 인 세트 주문은 프레임이 없어 부족으로 남는다
        mvc.perform(get("/api/orders/{no}", "ORD202607210029"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("재고 부족"))
                .andExpect(jsonPath("$.readiness.demands[?(@.itemCode=='FRM-DMN-Q')].shortageQuantity")
                        .value(1));
    }

    @Test
    @DisplayName("준비 상태로 주문 목록을 걸러낼 수 있다")
    void ordersCanBeFilteredByReadiness() throws Exception {
        mvc.perform(get("/api/orders").param("readiness", "SHORTAGE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(7));
        mvc.perform(get("/api/orders").param("readiness", "REVIEW_REQUIRED"))
                .andExpect(jsonPath("$.length()").value(3));
        mvc.perform(get("/api/orders").param("warehouseCode", "WH-CJ"))
                .andExpect(jsonPath("$.length()").value(3));
    }
}
