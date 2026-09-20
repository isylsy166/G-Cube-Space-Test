package test.gcube.repository;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import test.gcube.entity.OrderReservation;

public interface OrderReservationRepository extends JpaRepository<OrderReservation, Long> {

    boolean existsByOrderId(Long orderId);

    @Query("""
            select r from OrderReservation r
            join fetch r.item
            join fetch r.stock
            where r.order.id = :orderId
            """)
    List<OrderReservation> findByOrderIdWithRefs(@Param("orderId") Long orderId);

    /** 출고처럼 예약을 소비하는 처리는 행을 잠그고 읽는다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from OrderReservation r where r.order.id = :orderId")
    List<OrderReservation> findByOrderIdForUpdate(@Param("orderId") Long orderId);

    Optional<OrderReservation> findByOrderIdAndItemId(Long orderId, Long itemId);

    /**
     * 이미 예약이 잡혀 있는 주문. 이 주문들의 수량은 stock.booked_quantity 에 들어가 있다.
     *
     * <p>order 가 비어 있는 행(기준시각 이전 예약)은 주문 판정 대상이 아니므로 뺀다.
     */
    @Query("""
            select distinct r.order.id from OrderReservation r
            where r.order is not null
              and r.status = test.gcube.entity.enums.ReservationStatus.RESERVED
            """)
    List<Long> findReservedOrderIds();

    /**
     * 이 재고를 잡고 있는 예약 내역. 앱이 처리한 것과 기준시각 이전 것을 함께 준다.
     * 제품 페이지에서 "예약수량 N개를 누가 잡고 있는지" 에 답한다. (요구사항 4-1)
     */
    @Query("""
            select r from OrderReservation r
            join fetch r.item
            join fetch r.stock s
            join fetch s.warehouse
            left join fetch r.order
            where s.item.id = :itemId
              and r.status = test.gcube.entity.enums.ReservationStatus.RESERVED
            order by r.createdAt
            """)
    List<OrderReservation> findActiveByItemIdWithRefs(@Param("itemId") Long itemId);
}
