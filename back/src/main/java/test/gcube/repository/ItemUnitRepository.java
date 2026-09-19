package test.gcube.repository;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import test.gcube.entity.ItemUnit;
import test.gcube.entity.enums.ItemUnitStatus;

public interface ItemUnitRepository extends JpaRepository<ItemUnit, Long> {

    Optional<ItemUnit> findBySerialNumber(String serialNumber);

    boolean existsBySerialNumber(String serialNumber);

    List<ItemUnit> findByStockId(Long stockId);

    List<ItemUnit> findByStockIdAndStatus(Long stockId, ItemUnitStatus status);

    /** 품목 상세용. 개체는 stock 을 거쳐 품목에 연결된다. */
    @Query("""
            select u from ItemUnit u
            join fetch u.stock s
            join fetch s.warehouse
            where s.item.id = :itemId
            order by u.serialNumber
            """)
    List<ItemUnit> findByItemIdWithRefs(@Param("itemId") Long itemId);

    /** 이 주문에 배정된 개체. */
    @Query("""
            select u from ItemUnit u
            join fetch u.stock s
            join fetch s.warehouse
            where u.order.id = :orderId
            order by u.serialNumber
            """)
    List<ItemUnit> findByOrderIdWithRefs(@Param("orderId") Long orderId);

    /**
     * 피킹 대상 후보. 같은 창고에 보관 중이고 아직 어느 주문에도 배정되지 않은 개체.
     * 두 주문이 같은 개체를 집어가지 않도록 행을 잠그고 읽는다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select u from ItemUnit u
            where u.stock.id = :stockId
              and u.status = test.gcube.entity.enums.ItemUnitStatus.NORMAL
              and u.order is null
            order by u.serialNumber
            """)
    List<ItemUnit> findPickable(@Param("stockId") Long stockId);

    long countByStockId(Long stockId);

    /**
     * 이 주문에 이미 배정된 개체를 잠그고 읽는다.
     * 잠그지 않고 세면 동시에 들어온 피킹이 서로의 배정을 못 보고 개체를 두 번 집어간다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from ItemUnit u where u.order.id = :orderId and u.stock.id = :stockId")
    List<ItemUnit> findAssignedForUpdate(@Param("orderId") Long orderId,
                                         @Param("stockId") Long stockId);
}
