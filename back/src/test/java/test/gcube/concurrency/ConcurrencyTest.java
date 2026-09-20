package test.gcube.concurrency;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import test.gcube.dto.ReceiptRequest;
import test.gcube.entity.OrderReservation;
import test.gcube.entity.enums.ReservationStatus;
import test.gcube.entity.enums.ItemUnitStatus;
import test.gcube.repository.ItemRepository;
import test.gcube.repository.ItemUnitRepository;
import test.gcube.repository.OrderReservationRepository;
import test.gcube.repository.OrdersRepository;
import test.gcube.repository.StockRepository;
import test.gcube.repository.StockScheduleRepository;
import test.gcube.repository.WarehouseRepository;
import test.gcube.service.OrderCommandService;
import test.gcube.service.ScheduleCommandService;
import test.gcube.support.MySqlTestContainer;

/**
 * 동시 요청에서 숫자가 어긋나지 않는지 확
 *
 * <p>여기서는 트랜잭션을 실제로 커밋해야 락이 의미가 있으므로 {@code @Transactional} 을 쓰지 않고,
 * 각 테스트 전후로 기준 데이터를 다시 적재한다.
 */
@SpringBootTest
@Import(MySqlTestContainer.class)
class ConcurrencyTest {

    @Autowired DataSource dataSource;
    @Autowired OrderCommandService orderCommandService;
    @Autowired ScheduleCommandService scheduleCommandService;
    @Autowired StockRepository stockRepository;
    @Autowired StockScheduleRepository stockScheduleRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired ItemUnitRepository itemUnitRepository;
    @Autowired OrdersRepository ordersRepository;
    @Autowired OrderReservationRepository orderReservationRepository;
    @Autowired WarehouseRepository warehouseRepository;

    @BeforeEach
    @AfterEach
    void reloadSeed() throws Exception {
        try (var connection = dataSource.getConnection()) {
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("schema/sample.sql"));
        }
    }

    @Test
    @DisplayName("같은 주문을 동시에 예약해도 예약수량은 한 번만 늘어난다")
    void concurrentReservationsAreAppliedOnce() {
        int before = bookedOf("WH-HQ", "MAT-Z10-Q");

        Result result = runConcurrently(8,
                () -> orderCommandService.reserve("ORD202607200001"));

        // 늦게 도착한 요청은 order_reservation 의 UNIQUE 제약에 걸려 거부된다.
        // 중요한 것은 예약수량이 딱 한 번만 늘었다는 점이다.
        assertThat(result.successes()).isPositive();
        assertThat(bookedOf("WH-HQ", "MAT-Z10-Q")).isEqualTo(before + 1);
    }

    @Test
    @DisplayName("같은 주문을 동시에 예약해도 가용재고를 넘겨 예약되지 않는다")
    void concurrentSameOrderCannotOverbookStock() {
        // WH-CJ 의 CVR-WP-K 는 2개뿐이고, ORD202607210028 이 2개를 필요로 한다.
        int quantity = stockRepository
                .findByWarehouseIdAndItemId(idOfWarehouse("WH-CJ"), idOfItem("CVR-WP-K"))
                .orElseThrow().getQuantity();

        Result result = runConcurrently(8,
                () -> orderCommandService.reserve("ORD202607210028"));

        assertThat(result.successes()).isPositive();
        assertThat(bookedOf("WH-CJ", "CVR-WP-K")).isEqualTo(2);
        assertThat(bookedOf("WH-CJ", "CVR-WP-K")).isLessThanOrEqualTo(quantity);
    }

    @Test
    @DisplayName("같은 재고를 쓰는 서로 다른 주문이 동시에 예약해도 예약수량이 유실되지 않는다")
    void concurrentOrdersOnSharedStockDoNotLoseReservations() {
        // WH-08 의 PIL-ZERO 를 ORD202607200009(4개) 와 ORD202607200027(3개) 가 함께 쓴다.
        // 판정이 전 재고를 1차 캐시에 올린 뒤 예약하므로, 락만 잡고 숫자를 다시 읽지 않으면
        // 뒤 트랜잭션이 옛날 값 위에 덮어써서 앞 트랜잭션의 예약이 통째로 사라진다.
        int before = bookedOf("WH-08", "PIL-ZERO");

        Result result = runConcurrently(List.of(
                () -> orderCommandService.reserve("ORD202607200009"),
                () -> orderCommandService.reserve("ORD202607200027")));

        assertThat(result.successes()).isPositive();
        // 성공한 예약이 몇 건이든, 예약수량은 실제로 걸려 있는 예약 행의 합과 정확히 맞아야 한다.
        // 기준시각 이전 예약도 행으로 남아 있으므로 before 를 더하지 않고 전체 합과 비교한다.
        // 예약이 유실되면 booked 가 합보다 작아지고, 중복 반영되면 커진다.
        assertThat(bookedOf("WH-08", "PIL-ZERO"))
                .isEqualTo(reservedQuantityOf("WH-08", "PIL-ZERO"));
        assertThat(bookedOf("WH-08", "PIL-ZERO"))
                .isGreaterThan(before);
        assertThat(bookedOf("WH-08", "PIL-ZERO"))
                .isLessThanOrEqualTo(quantityOf("WH-08", "PIL-ZERO"));
    }

    @Test
    @DisplayName("같은 문서를 동시에 입고해도 누적 입고수량이 계획수량을 넘지 않는다")
    void concurrentReceiptsCannotExceedPlan() {
        // PO-20260719-DMN : 계획 3, 입고 1 → 남은 2. 2개씩 8번 동시에 넣어 본다.
        int before = quantityOf("WH-HQ", "FRM-DMN-Q");

        Result result = runConcurrently(8, () ->
                scheduleCommandService.receive("PO-20260719-DMN", new ReceiptRequest(2), null));

        var schedule = stockScheduleRepository.findByCode("PO-20260719-DMN").orElseThrow();
        assertThat(result.successes()).isEqualTo(1);   // 한 번만 성공해야 한다
        assertThat(schedule.getReceivedQuantity()).isEqualTo(3);
        assertThat(schedule.getReceivedQuantity()).isLessThanOrEqualTo(schedule.getPlanQuantity());
        assertThat(quantityOf("WH-HQ", "FRM-DMN-Q")).isEqualTo(before + 2);
    }

    @Test
    @DisplayName("같은 멱등 키로 동시에 입고해도 현재고는 한 번만 늘어난다")
    void concurrentReceiptsWithSameKeyApplyOnce() {
        int before = quantityOf("WH-HQ", "CVR-WP-Q");

        runConcurrently(8, () -> scheduleCommandService.receive(
                "PO-20260720-CVR", new ReceiptRequest(2), "same-key-001"));

        assertThat(quantityOf("WH-HQ", "CVR-WP-Q")).isEqualTo(before + 2);
        assertThat(stockScheduleRepository.findByCode("PO-20260720-CVR").orElseThrow()
                .getReceivedQuantity()).isEqualTo(2);
    }

    @Test
    @DisplayName("동시에 피킹해도 같은 시리얼 개체가 두 주문에 배정되지 않는다")
    void concurrentPickingDoesNotDoubleAssign() {
        orderCommandService.reserve("ORD202607200001");

        runConcurrently(8, () -> orderCommandService.pick("ORD202607200001"));

        Long orderId = ordersRepository.findByOrderNumber("ORD202607200001").orElseThrow().getId();
        long assigned = itemUnitRepository.findByOrderIdWithRefs(orderId).stream()
                .filter(u -> u.getStatus() == ItemUnitStatus.RESERVED)
                .count();
        assertThat(assigned).isEqualTo(1);
    }

    @Test
    @DisplayName("서로 다른 주문이 같은 개체를 직접 골라도 한 주문에만 배정된다")
    void concurrentChosenPickingAssignsUnitOnce() {
        // ORD202607200001 과 ORD202607200002(세트 SET-Z10-DMN-Q) 는 둘 다
        // WH-HQ 의 MAT-Z10-Q 를 1개씩 쓴다.
        orderCommandService.reserve("ORD202607200001");
        orderCommandService.reserve("ORD202607200002");

        List<String> chosen = List.of("UNIT-Z10-Q-0001");
        Result result = runConcurrently(List.of(
                () -> orderCommandService.pick("ORD202607200001", chosen),
                () -> orderCommandService.pick("ORD202607200002", chosen)));

        // 늦게 도착한 쪽은 잠금이 풀린 뒤 바뀐 상태를 보고 거절된다.
        assertThat(result.successes()).isEqualTo(1);
        var unit = itemUnitRepository.findBySerialNumber("UNIT-Z10-Q-0001").orElseThrow();
        assertThat(unit.getStatus()).isEqualTo(ItemUnitStatus.RESERVED);
        assertThat(unit.getOrder()).isNotNull();
    }

    // ---------- 도우미 ----------

    private record Result(int successes, int failures) {
    }

    /** 스레드 수만큼 동시에 같은 작업을 던지고 성공·실패 건수를 센다. */
    private Result runConcurrently(int threads, Runnable work) {
        return runConcurrently(Collections.nCopies(threads, work));
    }

    /** 서로 다른 작업을 한꺼번에 던지고 성공·실패 건수를 센다. */
    private Result runConcurrently(List<Runnable> works) {
        AtomicInteger ok = new AtomicInteger();
        AtomicInteger failed = new AtomicInteger();
        CountDownLatch start = new CountDownLatch(1);

        ExecutorService pool = Executors.newFixedThreadPool(works.size());
        try {
            List<Future<Void>> futures = new ArrayList<>();
            for (Runnable work : works) {
                futures.add(pool.submit((Callable<Void>) () -> {
                    start.await(5, TimeUnit.SECONDS);
                    try {
                        work.run();
                        ok.incrementAndGet();
                    } catch (RuntimeException e) {
                        failed.incrementAndGet();
                    }
                    return null;
                }));
            }
            start.countDown();
            for (Future<Void> future : futures) {
                try {
                    future.get(30, TimeUnit.SECONDS);
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            }
        } finally {
            pool.shutdown();
        }
        return new Result(ok.get(), failed.get());
    }

    private Long idOfWarehouse(String code) {
        return warehouseRepository.findByCode(code).orElseThrow().getId();
    }

    private Long idOfItem(String code) {
        return itemRepository.findByCode(code).orElseThrow().getId();
    }

    private int bookedOf(String warehouseCode, String itemCode) {
        return stockRepository.findByWarehouseIdAndItemId(
                        idOfWarehouse(warehouseCode), idOfItem(itemCode))
                .orElseThrow().getBookedQuantity();
    }

    private int quantityOf(String warehouseCode, String itemCode) {
        return stockRepository.findByWarehouseIdAndItemId(
                        idOfWarehouse(warehouseCode), idOfItem(itemCode))
                .orElseThrow().getQuantity();
    }

    /**
     * 그 재고에 걸려 있는 예약 행 수량의 합. 기준시각 이전 예약(order 가 없는 행)도 센다.
     * {@code stock.booked_quantity} 는 항상 이 값과 같아야 한다.
     */
    private int reservedQuantityOf(String warehouseCode, String itemCode) {
        Long stockId = stockRepository.findByWarehouseIdAndItemId(
                idOfWarehouse(warehouseCode), idOfItem(itemCode)).orElseThrow().getId();
        return orderReservationRepository.findAll().stream()
                .filter(r -> r.getStock().getId().equals(stockId))
                .filter(r -> r.getStatus() == ReservationStatus.RESERVED)
                .mapToInt(OrderReservation::getQuantity)
                .sum();
    }
}
