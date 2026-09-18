package test.gcube.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import test.gcube.entity.RequestLog;

public interface RequestLogRepository extends JpaRepository<RequestLog, Long> {

    Optional<RequestLog> findByIdempotencyKey(String idempotencyKey);
}
