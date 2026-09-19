package test.gcube.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import test.gcube.entity.Stock;

public interface StockRepository extends JpaRepository<Stock, Long> {

    Optional<Stock> findByWarehouseIdAndItemId(Long warehouseId, Long itemId);

    List<Stock> findByWarehouseId(Long warehouseId);

    List<Stock> findByItemId(Long itemId);

    List<Stock> findByWarehouseIdAndItemIdIn(Long warehouseId, Collection<Long> itemIds);

    /** 품목 상세용. 창고까지 한 번에 읽는다. */
    @Query("select s from Stock s join fetch s.warehouse where s.item.id = :itemId order by s.warehouse.code")
    List<Stock> findByItemIdWithWarehouse(@Param("itemId") Long itemId);

    /** 목록 화면용. 품목별 합계를 내기 위해 전 재고를 창고와 함께 읽는다. */
    @Query("select s from Stock s join fetch s.warehouse join fetch s.item")
    List<Stock> findAllWithRefs();

    /**
     * 재고를 바꾸기 직전에 행을 잠근다. (요구사항 3-4)
     *
     * <p><b>주의.</b> 이 엔티티가 같은 트랜잭션에서 이미 조회되어 1차 캐시에 올라와 있으면,
     * 하이버네이트는 {@code for update} 로 읽어온 값을 버리고 캐시에 있던 인스턴스를 돌려준다.
     * 락은 잡히지만 숫자는 낡은 채로 남는다. 앞서 재고를 읽은 적이 있는 흐름에서는 이 메서드
     * 대신 {@code EntityManager#refresh(entity, PESSIMISTIC_WRITE)} 로 상태까지 덮어써야 한다.
     * {@code OrderCommandService#reserve} 가 그런 경우다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Stock s where s.warehouse.id = :warehouseId and s.item.id = :itemId")
    Optional<Stock> findForUpdate(@Param("warehouseId") Long warehouseId,
                                  @Param("itemId") Long itemId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Stock s where s.id = :id")
    Optional<Stock> findByIdForUpdate(@Param("id") Long id);
}
