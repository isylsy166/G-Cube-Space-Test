package test.gcube.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import test.gcube.entity.Supplier;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {

    Optional<Supplier> findByCode(String code);
}
