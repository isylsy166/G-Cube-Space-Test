package test.gcube.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import test.gcube.entity.StockLedger;

public interface StockLedgerRepository extends JpaRepository<StockLedger, Long> {

    /** 품목의 재고 변화 이력. 최신 건이 먼저 온다. */
    @Query("""
            select l from StockLedger l
            join fetch l.stock s
            join fetch s.warehouse
            left join fetch l.order
            left join fetch l.stockSchedule
            where s.item.id = :itemId
            order by l.id desc
            """)
    List<StockLedger> findByItemIdWithRefs(@Param("itemId") Long itemId);

    @Query("""
            select l from StockLedger l
            join fetch l.stock s
            join fetch s.warehouse
            left join fetch l.order
            left join fetch l.stockSchedule
            where l.order.id = :orderId
            order by l.id desc
            """)
    List<StockLedger> findByOrderIdWithRefs(@Param("orderId") Long orderId);

    @Query("""
            select l from StockLedger l
            join fetch l.stock s
            join fetch s.warehouse
            left join fetch l.order
            left join fetch l.stockSchedule
            where l.stockSchedule.id = :scheduleId
            order by l.id desc
            """)
    List<StockLedger> findByScheduleIdWithRefs(@Param("scheduleId") Long scheduleId);
}
