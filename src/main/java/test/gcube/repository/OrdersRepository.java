package test.gcube.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import test.gcube.entity.Orders;
import test.gcube.entity.enums.OrderStatus;

public interface OrdersRepository extends JpaRepository<Orders, Long> {

    Optional<Orders> findByOrderNumber(String orderNumber);

    boolean existsByOrderNumber(String orderNumber);

    List<Orders> findByOrderStatus(OrderStatus orderStatus);

    /** 배송 예정일 구간으로 집계할 때 사용한다. */
    List<Orders> findByDeliveryAtBetween(LocalDateTime from, LocalDateTime to);

    /** 배송예정일이 빠른 주문 먼저, 같으면 접수일시가 빠른 주문 먼저 (요구사항 3-3). */
    List<Orders> findAllByOrderByDeliveryAtAscCreatedAtAsc();

    /** 준비 대상 주문을 우선순위대로. 배송예정일 → 접수일시 순. (요구사항 3-3) */
    @Query("""
            select o from Orders o
            join fetch o.warehouse
            where o.orderStatus = test.gcube.entity.enums.OrderStatus.CONFIRMED
            order by o.deliveryAt, o.createdAt
            """)
    List<Orders> findPreparationTargets();

    @Query("select o from Orders o join fetch o.warehouse where o.orderNumber = :orderNumber")
    Optional<Orders> findByOrderNumberWithWarehouse(@Param("orderNumber") String orderNumber);

    @Query("select o from Orders o join fetch o.warehouse order by o.deliveryAt, o.createdAt")
    List<Orders> findAllWithWarehouse();
}
