package test.gcube.repository;

import java.util.Collection;
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

    /** 시리얼 개체가 한 개라도 배정된 주문. 목록에서 처리 단계를 보여 줄 때 쓴다. */
    @Query("select distinct u.order.id from ItemUnit u where u.order is not null")
    List<Long> findAssignedOrderIds();

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
              and u.externalReference is null
            order by u.serialNumber
            """)
    List<ItemUnit> findPickable(@Param("stockId") Long stockId);

    /**
     * 직접 선택 화면에 보여 줄 후보. {@code findPickable} 과 조건은 같지만 잠그지 않고,
     * 창고까지 함께 읽어 화면에 필요한 정보를 한 번에 채운다.
     */
    @Query("""
            select u from ItemUnit u
            join fetch u.stock s
            join fetch s.warehouse
            where s.id = :stockId
              and u.status = test.gcube.entity.enums.ItemUnitStatus.NORMAL
              and u.order is null
              and u.externalReference is null
            order by u.serialNumber
            """)
    List<ItemUnit> findSelectableWithRefs(@Param("stockId") Long stockId);

    /**
     * 담당자가 직접 고른 개체를 잠그고 읽는다. 같은 개체를 동시에 고른 요청 중
     * 하나만 먼저 진행하고, 나머지는 잠금이 풀린 뒤 바뀐 상태를 보고 거절된다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select u from ItemUnit u
            where u.serialNumber in :serialNumbers
            order by u.serialNumber
            """)
    List<ItemUnit> findBySerialNumbersForUpdate(
            @Param("serialNumbers") Collection<String> serialNumbers);

    /** 배정 해제할 개체 한 건을 잠그고 읽는다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from ItemUnit u where u.serialNumber = :serialNumber")
    Optional<ItemUnit> findBySerialNumberForUpdate(@Param("serialNumber") String serialNumber);

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
