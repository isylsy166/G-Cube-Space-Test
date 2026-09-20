package test.gcube.api;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.context.jdbc.Sql;
import java.util.List;
import test.gcube.dto.InspectionRequest;
import test.gcube.dto.PickRequest;
import test.gcube.dto.ReceiptRequest;
import test.gcube.dto.ScheduleCreateRequest;

/**
 * 예약 → 피킹 → 출고, 발주 → 검사 → 입고. 요구사항 5의 시나리오 6~8 과
 * 요구사항 4-4 의 화면 간 연결을 확인한다.
 *
 * <p>각 테스트는 트랜잭션 안에서 돌고 끝나면 되돌아가므로 기준 데이터를 더럽히지 않는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
// 테스트마다 기준 데이터를 다시 적재한다. 개발용 MySQL 은 실행 중인 앱과
// 공유하므로, 앞선 실행이나 브라우저가 남긴 상태에 기대지 않는다.
@Sql("classpath:schema/sample.sql")
class CommandFlowTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    // ---------- 시나리오 6 : 예약·피킹·출고와 반복 요청 ----------

    @Test
    @DisplayName("예약은 현재고를 줄이지 않고 예약수량만 늘린다")
    void reserveOnlyIncreasesBooked() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reservations.length()").value(1))
                .andExpect(jsonPath("$.reservations[0].itemCode").value("MAT-Z10-Q"))
                .andExpect(jsonPath("$.reservations[0].quantity").value(1));

        // 현재고 3 그대로, 예약 1 → 2, 가용 2 → 1
        mvc.perform(get("/api/items/{code}", "MAT-Z10-Q"))
                .andExpect(jsonPath("$.stocks[?(@.warehouseCode=='WH-HQ')].quantity").value(3))
                .andExpect(jsonPath("$.stocks[?(@.warehouseCode=='WH-HQ')].bookedQuantity").value(2))
                .andExpect(jsonPath("$.stocks[?(@.warehouseCode=='WH-HQ')].availableQuantity").value(1));
    }

    @Test
    @DisplayName("시나리오 6 - 같은 예약 요청을 반복해도 예약수량이 중복으로 늘지 않는다")
    void reserveIsIdempotent() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001")).andExpect(status().isOk());
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001")).andExpect(status().isOk());
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reservations.length()").value(1));

        mvc.perform(get("/api/items/{code}", "MAT-Z10-Q"))
                .andExpect(jsonPath("$.stocks[?(@.warehouseCode=='WH-HQ')].bookedQuantity").value(2));
    }

    @Test
    @DisplayName("시나리오 4 - 한 품목이라도 부족하면 어떤 품목도 예약되지 않는다")
    void partialReservationIsRejected() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200015"))
                .andExpect(status().isConflict());

        // 같이 주문된 CVR-WP-Q 의 예약수량도 그대로여야 한다
        mvc.perform(get("/api/items/{code}", "CVR-WP-Q"))
                .andExpect(jsonPath("$.stocks[?(@.warehouseCode=='WH-HQ')].bookedQuantity").value(1));
        mvc.perform(get("/api/orders/{no}", "ORD202607200015"))
                .andExpect(jsonPath("$.reservations.length()").value(0));
    }

    @Test
    @DisplayName("시리얼 피킹은 보관 중인 개체만 주문에 배정한다")
    void pickingAssignsOnlyAvailableUnits() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"));
        mvc.perform(post("/api/orders/{no}/picking", "ORD202607200001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pickedUnits.length()").value(1))
                .andExpect(jsonPath("$.pickedUnits[0].statusLabel").value("주문 배정됨"));

        // 이미 다른 주문에 배정된 UNIT-Z10-Q-0003 은 선택되지 않는다
        mvc.perform(get("/api/orders/{no}", "ORD202607200001"))
                .andExpect(jsonPath("$.pickedUnits[0].serialNumber").value("UNIT-Z10-Q-0001"));
    }

    @Test
    @DisplayName("피킹을 반복해도 배정 개체가 늘지 않는다")
    void pickingIsIdempotent() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"));
        mvc.perform(post("/api/orders/{no}/picking", "ORD202607200001"));
        mvc.perform(post("/api/orders/{no}/picking", "ORD202607200001"))
                .andExpect(jsonPath("$.pickedUnits.length()").value(1));
    }

    @Test
    @DisplayName("직접 선택하면 고른 개체만 배정된다")
    void pickingAssignsChosenUnits() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"));

        // 자동 배정이었다면 시리얼번호가 빠른 UNIT-Z10-Q-0001 이 잡혔을 자리다
        mvc.perform(pick("ORD202607200001", "UNIT-Z10-Q-0002"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pickedUnits.length()").value(1))
                .andExpect(jsonPath("$.pickedUnits[0].serialNumber").value("UNIT-Z10-Q-0002"));
    }

    @Test
    @DisplayName("직접 선택에서 같은 개체를 다시 보내도 배정이 늘지 않는다")
    void chosenPickingIsIdempotent() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"));
        mvc.perform(pick("ORD202607200001", "UNIT-Z10-Q-0002"));
        mvc.perform(pick("ORD202607200001", "UNIT-Z10-Q-0002"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pickedUnits.length()").value(1));
    }

    @Test
    @DisplayName("다른 주문에 배정된 개체는 직접 선택해도 배정되지 않는다")
    void chosenPickingRejectsAssignedUnit() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"));
        mvc.perform(pick("ORD202607200001", "UNIT-Z10-Q-0003"))
                .andExpect(status().isConflict());

        mvc.perform(get("/api/orders/{no}", "ORD202607200001"))
                .andExpect(jsonPath("$.pickedUnits.length()").value(0));
    }

    @Test
    @DisplayName("예약수량보다 많이 고르면 한 개도 배정되지 않는다")
    void chosenPickingRejectsOverReservedQuantity() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"));
        // 예약은 1 개인데 2 개를 골랐다
        mvc.perform(pick("ORD202607200001", "UNIT-Z10-Q-0001", "UNIT-Z10-Q-0002"))
                .andExpect(status().isConflict());

        mvc.perform(get("/api/orders/{no}", "ORD202607200001"))
                .andExpect(jsonPath("$.pickedUnits.length()").value(0));
    }

    @Test
    @DisplayName("이 주문이 예약하지 않은 재고의 개체는 고를 수 없다")
    void chosenPickingRejectsUnrelatedUnit() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"));
        // 주문에 없는 품목(MAT-V3-Q)의 개체
        mvc.perform(pick("ORD202607200001", "UNIT-V3-Q-0001"))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("없는 시리얼번호를 고르면 찾을 수 없다고 알려준다")
    void chosenPickingRejectsUnknownSerial() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"));
        mvc.perform(pick("ORD202607200001", "UNIT-NOT-EXIST-0001"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("배정을 해제하면 개체가 보관 중으로 돌아가고 다시 고를 수 있다")
    void unpickReturnsUnitToStock() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"));
        mvc.perform(pick("ORD202607200001", "UNIT-Z10-Q-0002"));

        mvc.perform(delete("/api/orders/{no}/picking/{serial}", "ORD202607200001", "UNIT-Z10-Q-0002"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pickedUnits.length()").value(0));

        mvc.perform(get("/api/items/{code}", "MAT-Z10-Q"))
                .andExpect(jsonPath("$.units[?(@.serialNumber=='UNIT-Z10-Q-0002')].statusLabel")
                        .value("창고 보관 중"));

        // 해제한 뒤 다른 개체로 바꿔 배정할 수 있다
        mvc.perform(pick("ORD202607200001", "UNIT-Z10-Q-0001"))
                .andExpect(jsonPath("$.pickedUnits[0].serialNumber").value("UNIT-Z10-Q-0001"));
    }

    @Test
    @DisplayName("출고된 개체는 배정을 해제할 수 없다")
    void unpickRejectsShippedUnit() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"));
        mvc.perform(pick("ORD202607200001", "UNIT-Z10-Q-0002"));
        mvc.perform(post("/api/orders/{no}/shipment", "ORD202607200001"));

        mvc.perform(delete("/api/orders/{no}/picking/{serial}", "ORD202607200001", "UNIT-Z10-Q-0002"))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("후보 개체는 예약수량과 아직 고를 수 있는 개체를 함께 준다")
    void pickableUnitsShowCandidates() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"));

        mvc.perform(get("/api/orders/{no}/pickable-units", "ORD202607200001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].itemCode").value("MAT-Z10-Q"))
                .andExpect(jsonPath("$[0].reservedQuantity").value(1))
                .andExpect(jsonPath("$[0].remainingQuantity").value(1))
                // 보관 중인 0001·0002 만 후보다. 다른 주문에 배정된 0003 과 출고된 0000 은 빠진다
                .andExpect(jsonPath("$[0].candidates.length()").value(2))
                .andExpect(jsonPath("$[0].candidates[0].serialNumber").value("UNIT-Z10-Q-0001"));

        mvc.perform(pick("ORD202607200001", "UNIT-Z10-Q-0001"));
        mvc.perform(get("/api/orders/{no}/pickable-units", "ORD202607200001"))
                .andExpect(jsonPath("$[0].assignedQuantity").value(1))
                .andExpect(jsonPath("$[0].remainingQuantity").value(0))
                .andExpect(jsonPath("$[0].candidates.length()").value(1));
    }

    @Test
    @DisplayName("피킹이 끝나지 않은 시리얼 품목은 출고할 수 없다")
    void shipmentRequiresPicking() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"));
        mvc.perform(post("/api/orders/{no}/shipment", "ORD202607200001"))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("시나리오 6 - 출고는 현재고와 예약수량을 함께 줄이고, 반복해도 한 번만 반영된다")
    void shipmentIsIdempotent() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"));
        mvc.perform(post("/api/orders/{no}/picking", "ORD202607200001"));

        mvc.perform(post("/api/orders/{no}/shipment", "ORD202607200001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.orderStatusLabel").value("출고 완료"))
                .andExpect(jsonPath("$.pickedUnits[0].statusLabel").value("출고 완료"));

        // 현재고 3 → 2, 예약 2 → 1
        mvc.perform(get("/api/items/{code}", "MAT-Z10-Q"))
                .andExpect(jsonPath("$.stocks[?(@.warehouseCode=='WH-HQ')].quantity").value(2))
                .andExpect(jsonPath("$.stocks[?(@.warehouseCode=='WH-HQ')].bookedQuantity").value(1));

        // 두 번, 세 번 출고해도 숫자가 더 줄지 않는다
        mvc.perform(post("/api/orders/{no}/shipment", "ORD202607200001")).andExpect(status().isOk());
        mvc.perform(post("/api/orders/{no}/shipment", "ORD202607200001")).andExpect(status().isOk());
        mvc.perform(get("/api/items/{code}", "MAT-Z10-Q"))
                .andExpect(jsonPath("$.stocks[?(@.warehouseCode=='WH-HQ')].quantity").value(2))
                .andExpect(jsonPath("$.stocks[?(@.warehouseCode=='WH-HQ')].bookedQuantity").value(1));
    }

    @Test
    @DisplayName("예약·출고 이력이 변화량과 변화 후 값으로 남는다")
    void ledgerRecordsEveryChange() throws Exception {
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200001"));
        mvc.perform(post("/api/orders/{no}/picking", "ORD202607200001"));
        mvc.perform(post("/api/orders/{no}/shipment", "ORD202607200001"));

        mvc.perform(get("/api/orders/{no}", "ORD202607200001"))
                .andExpect(jsonPath("$.ledgers.length()").value(2))
                // 최신 건이 먼저 온다
                .andExpect(jsonPath("$.ledgers[0].typeLabel").value("출고"))
                .andExpect(jsonPath("$.ledgers[0].quantityDelta").value(-1))
                .andExpect(jsonPath("$.ledgers[0].bookedDelta").value(-1))
                .andExpect(jsonPath("$.ledgers[0].quantityAfter").value(2))
                .andExpect(jsonPath("$.ledgers[1].typeLabel").value("예약"))
                .andExpect(jsonPath("$.ledgers[1].quantityDelta").value(0))
                .andExpect(jsonPath("$.ledgers[1].bookedDelta").value(1));
    }

    // ---------- 시나리오 7 : 부족 → 발주 → 입고 → 재판정 ----------

    @Test
    @DisplayName("시나리오 7 - 매입품 부족은 구매발주로 만들어지고, 발주만으로는 현재고가 늘지 않는다")
    void scenario7_purchaseOrderFromShortage() throws Exception {
        // ORD202607200024 : FRM-LOW-Q(매입품) 2개 부족
        String body = mvc.perform(post("/api/orders/{no}/purchase-orders", "ORD202607200024")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                new ScheduleCreateRequest("FRM-LOW-Q", null, null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.typeLabel").value("구매"))
                .andExpect(jsonPath("$.planQuantity").value(2))
                .andExpect(jsonPath("$.receivedQuantity").value(0))
                .andExpect(jsonPath("$.warehouseCode").value("WH-HQ"))
                .andExpect(jsonPath("$.supplierCode").value("SUP-FRAME"))
                .andExpect(jsonPath("$.confirmed").value(true))
                .andReturn().getResponse().getContentAsString();
        String code = json.readTree(body).get("code").asText();

        // 발주를 만든 것만으로 현재고는 그대로 0
        mvc.perform(get("/api/items/{code}", "FRM-LOW-Q"))
                .andExpect(jsonPath("$.stocks[?(@.warehouseCode=='WH-HQ')].quantity").value(0));

        // 주문에서 이 발주를 볼 수 있다 (요구사항 4-4)
        mvc.perform(get("/api/orders/{no}", "ORD202607200024"))
                .andExpect(jsonPath("$.schedules[0].code").value(code));

        // 발주 페이지 목록에도 같이 보인다
        mvc.perform(get("/api/stock-schedules"))
                .andExpect(jsonPath("$.length()").value(13));
    }

    @Test
    @DisplayName("시나리오 7 - 생산품 부족은 생산의뢰로 만들어지고 검사 전에는 입고할 수 없다")
    void scenario7_productionOrderNeedsInspection() throws Exception {
        String body = mvc.perform(post("/api/orders/{no}/purchase-orders", "ORD202607200020")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                new ScheduleCreateRequest("MAT-E5-SS", null, null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.typeLabel").value("생산"))
                .andExpect(jsonPath("$.planQuantity").value(1))
                .andExpect(jsonPath("$.inspectStatusLabel").value("검사 전"))
                .andReturn().getResponse().getContentAsString();
        String code = json.readTree(body).get("code").asText();

        // 검사 기록 없이는 입고 거부
        mvc.perform(post("/api/stock-schedules/{code}/receipt", code)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ReceiptRequest(1))))
                .andExpect(status().isConflict());

        // 검사 통과 후에는 입고된다
        mvc.perform(post("/api/stock-schedules/{code}/inspection", code)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new InspectionRequest(true))))
                .andExpect(jsonPath("$.inspectStatusLabel").value("검사 완료"));
        mvc.perform(post("/api/stock-schedules/{code}/receipt", code)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ReceiptRequest(1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.receivedQuantity").value(1))
                .andExpect(jsonPath("$.statusLabel").value("입고 완료"));
    }

    @Test
    @DisplayName("검사 불합격은 검사 대기 문서에서도 상태가 실제로 바뀌고 입고가 막힌다")
    void rejectedInspectionIsRecordedAndBlocksReceipt() throws Exception {
        // MO-20260721-Z10 은 시드에서 이미 '검사 대기' 다.
        // 불합격을 '검사 대기' 로 되돌리면 아무것도 바뀌지 않아 기록이 남았는지 알 수 없다.
        mvc.perform(get("/api/stock-schedules/{code}", "MO-20260721-Z10"))
                .andExpect(jsonPath("$.schedule.inspectStatusLabel").value("검사 대기"));

        mvc.perform(post("/api/stock-schedules/{code}/inspection", "MO-20260721-Z10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new InspectionRequest(false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inspectStatusLabel").value("검사 불합격"))
                // 불합격 물량은 앞으로 들어올 수량이 아니므로 판정에서 빠진다
                .andExpect(jsonPath("$.usableForPlanning").value(false));

        mvc.perform(post("/api/stock-schedules/{code}/receipt", "MO-20260721-Z10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ReceiptRequest(1))))
                .andExpect(status().isConflict());

        // 재검사를 통과하면 다시 입고할 수 있다
        mvc.perform(post("/api/stock-schedules/{code}/inspection", "MO-20260721-Z10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new InspectionRequest(true))))
                .andExpect(jsonPath("$.inspectStatusLabel").value("검사 완료"))
                .andExpect(jsonPath("$.usableForPlanning").value(true));
        mvc.perform(post("/api/stock-schedules/{code}/receipt", "MO-20260721-Z10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ReceiptRequest(1))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("검사 불합격 물량을 기다리던 주문은 재고 부족으로 되돌아간다")
    void rejectedInspectionPushesWaitingOrderBackToShortage() throws Exception {
        // ORD202607200007 은 MO-20260721-Z10 을 기다려 '품질검사 대기' 다
        mvc.perform(get("/api/orders/{no}", "ORD202607200007"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("품질검사 대기"))
                .andExpect(jsonPath("$.readiness.demands[0].fromSchedule").value(1));

        mvc.perform(post("/api/stock-schedules/{code}/inspection", "MO-20260721-Z10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new InspectionRequest(false))))
                .andExpect(status().isOk());

        // 들어오지 않을 물량이므로 더는 기다릴 대상이 아니다. 발주가 필요한 주문이 된다.
        mvc.perform(get("/api/orders/{no}", "ORD202607200007"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("재고 부족"))
                .andExpect(jsonPath("$.readiness.demands[0].fromSchedule").value(0))
                .andExpect(jsonPath("$.readiness.demands[0].shortageQuantity").value(1));
    }

    @Test
    @DisplayName("시나리오 7 - 입고하면 현재고가 늘고 기다리던 주문이 준비 가능으로 바뀐다")
    void scenario7_receiptUnblocksOrder() throws Exception {
        mvc.perform(get("/api/orders/{no}", "ORD202607200024"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("재고 부족"));

        String body = mvc.perform(post("/api/orders/{no}/purchase-orders", "ORD202607200024")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                new ScheduleCreateRequest("FRM-LOW-Q", null, null))))
                .andReturn().getResponse().getContentAsString();
        String code = json.readTree(body).get("code").asText();

        // 발주만으로는 아직 부족하지 않고 '구매 입고 대기' 로 바뀐다
        mvc.perform(get("/api/orders/{no}", "ORD202607200024"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("구매 입고 대기"));

        mvc.perform(post("/api/stock-schedules/{code}/receipt", code)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ReceiptRequest(2))))
                .andExpect(status().isOk());

        // 현재고가 늘고 주문이 바로 준비 가능이 된다
        mvc.perform(get("/api/items/{code}", "FRM-LOW-Q"))
                .andExpect(jsonPath("$.stocks[?(@.warehouseCode=='WH-HQ')].quantity").value(2));
        mvc.perform(get("/api/orders/{no}", "ORD202607200024"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("바로 준비 가능"));

        // 그 뒤 예약·피킹·출고까지 이어진다
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200024"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("서비스 품목은 발주 대상이 아니다")
    void serviceItemCannotBeOrdered() throws Exception {
        mvc.perform(post("/api/orders/{no}/purchase-orders", "ORD202607200024")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                new ScheduleCreateRequest("SVC-INSTALL", 1, null))))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("사용 중지된 창고로는 발주할 수 없다")
    void inactiveWarehouseCannotBeOrdered() throws Exception {
        mvc.perform(post("/api/orders/{no}/purchase-orders", "ORD202607200010")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                new ScheduleCreateRequest("MAT-Z10-Q", 1, null))))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("확인이 필요한 주문은 수량을 직접 지정해도 발주할 수 없다")
    void reviewRequiredOrderCannotBeOrdered() throws Exception {
        // ORD202607200026 : 주문 수량이 0 이라 확인 필요. 수량을 명시하면 부족수량 조회를
        // 건너뛰므로, 판정 상태를 보고 막지 않으면 이 요청이 통과한다. (요구사항 3-6)
        mvc.perform(post("/api/orders/{no}/purchase-orders", "ORD202607200026")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                new ScheduleCreateRequest("CVR-WP-Q", 5, null))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(
                        containsString("확인이 필요한 주문은 발주 대상이 아닙니다")));

        // 문서가 하나도 생기지 않았다
        mvc.perform(get("/api/stock-schedules").param("itemCode", "CVR-WP-Q"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    // ---------- 시나리오 8 : 입고 반복과 계획수량 초과 ----------

    @Test
    @DisplayName("시나리오 8 - 같은 멱등 키로 입고를 반복해도 한 번만 반영된다")
    void scenario8_receiptIsIdempotent() throws Exception {
        // PO-20260720-CVR : 계획 5, 입고 0
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/stock-schedules/{code}/receipt", "PO-20260720-CVR")
                            .header("Idempotency-Key", "receipt-cvr-001")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsString(new ReceiptRequest(2))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.receivedQuantity").value(2));
        }

        // 현재고는 6 → 8 한 번만 늘었다
        mvc.perform(get("/api/items/{code}", "CVR-WP-Q"))
                .andExpect(jsonPath("$.stocks[?(@.warehouseCode=='WH-HQ')].quantity").value(8));
    }

    @Test
    @DisplayName("시나리오 8 - 계획수량을 넘는 입고는 거부된다")
    void scenario8_overReceiptIsRejected() throws Exception {
        // 계획 3, 이미 1 입고 → 남은 2
        mvc.perform(post("/api/stock-schedules/{code}/receipt", "PO-20260719-DMN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ReceiptRequest(3))))
                .andExpect(status().isConflict());

        mvc.perform(post("/api/stock-schedules/{code}/receipt", "PO-20260719-DMN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ReceiptRequest(2))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.receivedQuantity").value(3))
                .andExpect(jsonPath("$.remainingQuantity").value(0))
                .andExpect(jsonPath("$.statusLabel").value("입고 완료"));

        // 남은 수량이 없는 문서는 다시 입고할 수 없다
        mvc.perform(post("/api/stock-schedules/{code}/receipt", "PO-20260719-DMN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ReceiptRequest(1))))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("시리얼 관리 품목을 입고하면 그 수량만큼 개체가 생긴다")
    void receiptCreatesSerialUnits() throws Exception {
        mvc.perform(get("/api/items/{code}", "FRM-DMN-Q"))
                .andExpect(jsonPath("$.units.length()").value(3)); // WH-HQ 1 + WH-LEGACY 2

        mvc.perform(post("/api/stock-schedules/{code}/receipt", "PO-20260719-DMN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ReceiptRequest(2))))
                .andExpect(status().isOk());

        mvc.perform(get("/api/items/{code}", "FRM-DMN-Q"))
                .andExpect(jsonPath("$.units.length()").value(5))
                .andExpect(jsonPath("$.stocks[?(@.warehouseCode=='WH-HQ')].quantity").value(3));
    }

    @Test
    @DisplayName("미확정 문서는 입고할 수 없고, 확정하면 입고할 수 있다")
    void draftScheduleCannotBeReceived() throws Exception {
        mvc.perform(post("/api/stock-schedules/{code}/receipt", "PO-20260721-PIL")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ReceiptRequest(1))))
                .andExpect(status().isConflict());

        mvc.perform(post("/api/stock-schedules/{code}/confirmation", "PO-20260721-PIL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmed").value(true));

        mvc.perform(post("/api/stock-schedules/{code}/receipt", "PO-20260721-PIL")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ReceiptRequest(10))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusLabel").value("입고 완료"));
    }

    @Test
    @DisplayName("발주 상세에서 어떤 주문 때문에 생겼는지와 입고 이력을 볼 수 있다")
    void scheduleDetailShowsSourceOrderAndLedger() throws Exception {
        String body = mvc.perform(post("/api/orders/{no}/purchase-orders", "ORD202607200024")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                new ScheduleCreateRequest("FRM-LOW-Q", null, null))))
                .andReturn().getResponse().getContentAsString();
        String code = json.readTree(body).get("code").asText();

        mvc.perform(post("/api/stock-schedules/{code}/receipt", code)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new ReceiptRequest(2))))
                .andExpect(status().isOk());

        mvc.perform(get("/api/stock-schedules/{code}", code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceOrderNumber").value("ORD202607200024"))
                .andExpect(jsonPath("$.ledgers.length()").value(1))
                .andExpect(jsonPath("$.ledgers[0].typeLabel").value("입고"))
                .andExpect(jsonPath("$.ledgers[0].quantityDelta").value(2))
                .andExpect(jsonPath("$.ledgers[0].quantityAfter").value(2))
                .andExpect(jsonPath("$.ledgers[0].orderNumber").value("ORD202607200024"));
    }

    @Test
    @DisplayName("예약한 주문이 자기 예약 때문에 재고 부족으로 뒤집히지 않는다")
    void reservedOrderStaysReady() throws Exception {
        // WH-CJ 의 CVR-WP-K 는 2개뿐이고 이 주문이 2개를 전부 쓴다
        mvc.perform(get("/api/orders/{no}", "ORD202607210028"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("바로 준비 가능"));

        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607210028"))
                .andExpect(status().isOk());

        mvc.perform(get("/api/orders/{no}", "ORD202607210028"))
                .andExpect(jsonPath("$.readiness.statusLabel").value("바로 준비 가능"))
                .andExpect(jsonPath("$.readiness.demands[?(@.itemCode=='CVR-WP-K')].shortageQuantity")
                        .value(0))
                .andExpect(jsonPath("$.reservations.length()").value(2));
    }

    @Test
    @DisplayName("예약된 주문의 수량이 뒤 주문 판정에서 두 번 빠지지 않는다")
    void reservedQuantityIsNotCountedTwice() throws Exception {
        // WH-08 PIL-ZERO 가용 8 → ORD202607200009 가 4를 예약하면 남은 4
        mvc.perform(post("/api/orders/{no}/reservation", "ORD202607200009"))
                .andExpect(status().isOk());

        // 뒤 주문은 여전히 4를 보고 1 부족이어야 한다 (8 만큼 두 번 빠지면 더 모자라게 보인다)
        mvc.perform(get("/api/orders/{no}", "ORD202607200012"))
                .andExpect(jsonPath("$.readiness.demands[0].availableQuantity").value(4))
                .andExpect(jsonPath("$.readiness.demands[0].shortageQuantity").value(1));
    }

    /** 직접 선택 피킹 요청 하나. */
    private MockHttpServletRequestBuilder pick(String orderNumber, String... serialNumbers) {
        return post("/api/orders/{no}/picking", orderNumber)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PickRequest(List.of(serialNumbers))));
    }
}
