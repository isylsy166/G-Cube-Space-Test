package test.gcube.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import test.gcube.entity.Warehouse;

public interface WarehouseRepository extends JpaRepository<Warehouse, Long> {

    Optional<Warehouse> findByCode(String code);

    boolean existsByCode(String code);

    /** 운영 중인 창고만 */
    List<Warehouse> findByStatusTrue();
}
