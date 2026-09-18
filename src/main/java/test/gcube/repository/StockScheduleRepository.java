package test.gcube.repository;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import test.gcube.entity.StockSchedule;
import test.gcube.entity.enums.ScheduleType;

public interface StockScheduleRepository extends JpaRepository<StockSchedule, Long> {

    Optional<StockSchedule> findByCode(String code);

    boolean existsByCode(String code);

    List<StockSchedule> findByWarehouseIdAndItemId(Long warehouseId, Long itemId);

    List<StockSchedule> findByItemId(Long itemId);

    List<StockSchedule> findBySupplierId(Long supplierId);

    /** 확정된 입고 예정만. 미확정(작성 중) 문서는 들어올 수량으로 보지 않는다. */
    List<StockSchedule> findByConfirmedTrue();

    /** 발주 페이지 목록용. 조건이 null 이면 그 조건은 무시한다. */
    @Query("""
            select sc from StockSchedule sc
            join fetch sc.item
            join fetch sc.warehouse
            join fetch sc.supplier
            where (:type is null or sc.type = :type)
              and (:warehouseCode is null or sc.warehouse.code = :warehouseCode)
              and (:itemCode is null or sc.item.code = :itemCode)
              and (:confirmed is null or sc.confirmed = :confirmed)
            order by sc.availableAt, sc.code
            """)
    List<StockSchedule> search(@Param("type") ScheduleType type,
                               @Param("warehouseCode") String warehouseCode,
                               @Param("itemCode") String itemCode,
                               @Param("confirmed") Boolean confirmed);

    @Query("""
            select sc from StockSchedule sc
            join fetch sc.item
            join fetch sc.warehouse
            join fetch sc.supplier
            where sc.code = :code
            """)
    Optional<StockSchedule> findByCodeWithRefs(@Param("code") String code);

    @Query("""
            select sc from StockSchedule sc
            join fetch sc.item
            join fetch sc.warehouse
            join fetch sc.supplier
            where sc.item.id = :itemId
            order by sc.availableAt, sc.code
            """)
    List<StockSchedule> findByItemIdWithRefs(@Param("itemId") Long itemId);

    @Query("""
            select sc from StockSchedule sc
            join fetch sc.item
            join fetch sc.warehouse
            join fetch sc.supplier
            """)
    List<StockSchedule> findAllWithRefs();

    /** 이 주문 때문에 생긴 발주 문서. (요구사항 3-5) */
    @Query("""
            select sc from StockSchedule sc
            join fetch sc.item
            join fetch sc.warehouse
            join fetch sc.supplier
            where sc.order.id = :orderId
            order by sc.code
            """)
    List<StockSchedule> findByOrderIdWithRefs(@Param("orderId") Long orderId);

    /** 발주 문서번호를 만들 때 같은 접두사가 몇 개나 있는지 센다. */
    long countByCodeStartingWith(String prefix);

    /**
     * 입고·검사처럼 문서를 바꾸는 처리는 행을 잠그고 읽는다.
     * 잠그지 않으면 동시에 들어온 두 입고가 같은 남은수량을 보고 계획수량을 넘길 수 있다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select sc from StockSchedule sc where sc.code = :code")
    Optional<StockSchedule> findByCodeForUpdate(@Param("code") String code);
}
