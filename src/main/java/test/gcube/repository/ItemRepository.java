package test.gcube.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import test.gcube.entity.Item;

public interface ItemRepository extends JpaRepository<Item, Long> {

    Optional<Item> findByCode(String code);

    /** 주문의 품목코드 묶음을 한 번에 조회할 때 사용한다. */
    List<Item> findByCodeIn(Collection<String> codes);

    boolean existsByCode(String code);

    List<Item> findBySupplierId(Long supplierId);

    /** 목록 화면용. 공급처까지 한 번에 읽는다. */
    @Query("select i from Item i join fetch i.supplier order by i.code")
    List<Item> findAllWithSupplier();

    @Query("select i from Item i join fetch i.supplier where i.code = :code")
    Optional<Item> findByCodeWithSupplier(@Param("code") String code);
}
