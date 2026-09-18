package test.gcube.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import test.gcube.entity.ItemSetComponent;

public interface ItemSetComponentRepository extends JpaRepository<ItemSetComponent, Long> {

    List<ItemSetComponent> findByItemSetId(Long itemSetId);

    /** 여러 세트를 한 번에 전개할 때 사용한다. */
    List<ItemSetComponent> findByItemSetIdIn(Collection<Long> itemSetIds);

    /** 출고 대상 구성품만. 서비스 항목은 제외된다. */
    List<ItemSetComponent> findByItemSetIdAndShippingTrue(Long itemSetId);

    Optional<ItemSetComponent> findByItemSetIdAndItemId(Long itemSetId, Long itemId);

    /** 세트 전개용. 여러 세트의 구성품을 품목까지 한 번에 읽는다. */
    @Query("""
            select c from ItemSetComponent c
            join fetch c.item
            where c.itemSet.id in :itemSetIds
            """)
    List<ItemSetComponent> findByItemSetIdInWithItem(@Param("itemSetIds") Collection<Long> itemSetIds);
}
