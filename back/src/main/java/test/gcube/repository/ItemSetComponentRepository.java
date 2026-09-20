package test.gcube.repository;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import test.gcube.entity.ItemSetComponent;

public interface ItemSetComponentRepository extends JpaRepository<ItemSetComponent, Long> {

    /** 세트 전개용. 여러 세트의 구성품을 품목까지 한 번에 읽는다. */
    @Query("""
            select c from ItemSetComponent c
            join fetch c.item
            where c.itemSet.id in :itemSetIds
            """)
    List<ItemSetComponent> findByItemSetIdInWithItem(@Param("itemSetIds") Collection<Long> itemSetIds);
}
