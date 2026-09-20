package test.gcube.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import test.gcube.entity.ItemSet;

public interface ItemSetRepository extends JpaRepository<ItemSet, Long> {

    Optional<ItemSet> findByCode(String code);
}
