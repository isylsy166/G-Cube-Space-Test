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
 * 창고. status 가 false 면 운영 중지된 창고다.
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

    /** 운영상태. true = 사용 중, false = 사용 중지 */
    @Column(name = "status", nullable = false)
    private boolean status;

    @Builder
    public Warehouse(String code, String name, boolean status) {
        this.code = code;
        this.name = name;
        this.status = status;
    }
}
