package test.gcube.concurrency;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
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
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import test.gcube.dto.ReceiptRequest;
import test.gcube.entity.enums.ItemUnitStatus;
import test.gcube.repository.ItemRepository;
import test.gcube.repository.ItemUnitRepository;
import test.gcube.repository.OrdersRepository;
import test.gcube.repository.StockRepository;
import test.gcube.repository.StockScheduleRepository;
import test.gcube.repository.WarehouseRepository;
import test.gcube.service.OrderCommandService;
import test.gcube.service.ScheduleCommandService;

/**
 * 동시 요청에서 숫자가 어긋나지 않는지 확인한다. (요구사항 6)
 *
 * <p>여기서는 트랜잭션을 실제로 커밋해야 락이 의미가 있으므로 {@code @Transactional} 을 쓰지 않고,
 * 각 테스트 전후로 기준 데이터를 다시 적재한다.
 */
@SpringBootTest
class ConcurrencyTest {

    @Autowired DataSource dataSource;
    @Autowired OrderCommandService orderCommandService;
    @Autowired ScheduleCommandService scheduleCommandService;
    @Autowired StockRepository stockRepository;
    @Autowired StockScheduleRepository stockScheduleRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired ItemUnitRepository itemUnitRepository;
    @Autowired OrdersRepository ordersRepository;
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
    @DisplayName("같은 재고를 노리는 서로 다른 주문이 동시에 들어와도 가용재고를 넘겨 예약되지 않는다")
    void concurrentOrdersCannotOverbookTheSameStock() {
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

    // ---------- 도우미 ----------

    private record Result(int successes, int failures) {
    }

    /** 스레드 수만큼 동시에 같은 작업을 던지고 성공·실패 건수를 센다. */
    private Result runConcurrently(int threads, Runnable work) {
        AtomicInteger ok = new AtomicInteger();
        AtomicInteger failed = new AtomicInteger();
        CountDownLatch start = new CountDownLatch(1);

        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            List<Future<Void>> futures = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
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
}
