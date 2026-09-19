package test.gcube.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

/**
 * 멱등 키 기록. UNIQUE 제약이 같은 요청의 중복 반영을 막는 실제 방어선이다.
 * 같은 키가 다시 오면 저장해 둔 resultCode 를 그대로 돌려준다.
 */
@Entity
@Table(
        name = "request_log",
        uniqueConstraints = @UniqueConstraint(
                name = "UK_REQUEST_LOG_KEY",
                columnNames = "idempotency_key"
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RequestLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "idempotency_key", nullable = false, length = 100)
    private String idempotencyKey;

    @Column(name = "request_type", nullable = false, length = 30)
    private String requestType;

    @Column(name = "result_code", length = 100)
    private String resultCode;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public RequestLog(String idempotencyKey, String requestType, String resultCode) {
        this.idempotencyKey = idempotencyKey;
        this.requestType = requestType;
        this.resultCode = resultCode;
    }
}
