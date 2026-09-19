package test.gcube.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import test.gcube.entity.enums.SupplierType;

/**
 * 공급처. 구매처와 생산처를 함께 담는다.
 */
@Entity
@Table(
        name = "supplier",
        uniqueConstraints = @UniqueConstraint(name = "UK_SUPPLIER_CODE", columnNames = "code")
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    /** 공급처 코드 (예: SUP-FRAME, FAC-01) */
    @Column(name = "code", nullable = false, length = 50)
    private String code;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /** 구분 (구매처 / 생산처 / 자사) */
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private SupplierType type;

    /** 리드타임 일수 */
    @Column(name = "lead_time_days", nullable = false)
    private int leadTimeDays;

    @Builder
    public Supplier(String code, String name, SupplierType type, int leadTimeDays) {
        this.code = code;
        this.name = name;
        this.type = type;
        this.leadTimeDays = leadTimeDays;
    }
}
