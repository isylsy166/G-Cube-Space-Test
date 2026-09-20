package test.gcube.repository;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import test.gcube.entity.OrderDetail;

public interface OrderDetailRepository extends JpaRepository<OrderDetail, Long> {

    /** 주문 상세용. 단품/세트 어느 쪽이든 한 번에 읽는다. */
    @Query("""
            select d from OrderDetail d
            left join fetch d.item
            left join fetch d.itemSet
            where d.order.id = :orderId
            order by d.sequence
            """)
    List<OrderDetail> findByOrderIdWithRefs(@Param("orderId") Long orderId);

    @Query("""
            select d from OrderDetail d
            left join fetch d.item
            left join fetch d.itemSet
            where d.order.id in :orderIds
            order by d.order.id, d.sequence
            """)
    List<OrderDetail> findByOrderIdInWithRefs(@Param("orderIds") Collection<Long> orderIds);
}
