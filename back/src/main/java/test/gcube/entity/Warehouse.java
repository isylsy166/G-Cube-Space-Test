package test.gcube.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 창고. active 가 false 면 사용 중지된 창고다.
 * 이 창고의 재고와 입고예정은 준비 판단에 쓰지 않는다. (요구사항 3-2)
 */
@Entity
@Table(
        name = "warehouse",
        uniqueConstraints = @UniqueConstraint(name = "UK_WAREHOUSE_CODE", columnNames = "code")
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Warehouse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    /** 창고 코드 (예: WH-HQ) */
    @Column(name = "code", nullable = false, length = 50)
    private String code;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /** 운영상태. true = 사용 중, false = 사용 중지. 컬럼명은 원본 데이터에 맞춰 status 다. */
    @Column(name = "status", nullable = false)
    private boolean active;

    @Builder
    public Warehouse(String code, String name, boolean active) {
        this.code = code;
        this.name = name;
        this.active = active;
    }
}
