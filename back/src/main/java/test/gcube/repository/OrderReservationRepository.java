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

    /** 이미 예약이 잡혀 있는 주문. 이 주문들의 수량은 stock.booked_quantity 에 들어가 있다. */
    @Query("""
            select distinct r.order.id from OrderReservation r
            where r.status = test.gcube.entity.enums.ReservationStatus.RESERVED
            """)
    List<Long> findReservedOrderIds();
}
