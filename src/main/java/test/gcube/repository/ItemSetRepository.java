package test.gcube.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import test.gcube.entity.ItemSet;

public interface ItemSetRepository extends JpaRepository<ItemSet, Long> {

    Optional<ItemSet> findByCode(String code);

    List<ItemSet> findByCodeIn(Collection<String> codes);

    boolean existsByCode(String code);
}
