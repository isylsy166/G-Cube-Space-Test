package test.gcube.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import test.gcube.entity.OrderDetail;

public interface OrderDetailRepository extends JpaRepository<OrderDetail, Long> {

    List<OrderDetail> findByOrderIdOrderBySequenceAsc(Long orderId);

    /** 여러 주문의 상세를 한 번에 조회할 때 사용한다. */
    List<OrderDetail> findByOrderIdIn(Collection<Long> orderIds);

    Optional<OrderDetail> findByOrderIdAndSequence(Long orderId, int sequence);

    List<OrderDetail> findByItemId(Long itemId);

    List<OrderDetail> findByItemSetId(Long itemSetId);

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
