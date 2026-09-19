package test.gcube.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import test.gcube.entity.enums.ItemType;

/**
 * 품목. 세트상품은 {@link ItemSet} 으로 따로 관리하므로 여기에는 담지 않는다.
 */
@Entity
@Table(
        name = "item",
        uniqueConstraints = @UniqueConstraint(name = "UK_ITEM_CODE", columnNames = "code")
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Item {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    /** 기본 공급처 */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    /** 품목 코드 (예: MAT-Z10-Q) */
    @Column(name = "code", nullable = false, length = 50)
    private String code;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /** 유형 (생산품 / 매입품 / 서비스) */
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 50)
    private ItemType type;

    /** 분류 (매트리스 / 프레임 / 침구 ...) */
    @Column(name = "category", nullable = false, length = 50)
    private String category;

    /** 시리얼 관리 여부. true 면 {@link ItemUnit} 으로 개체를 추적한다. */
    @Column(name = "is_serial", nullable = false)
    private boolean serial;

    /** 규격 (Q / K / SS ...) */
    @Column(name = "spec", length = 255)
    private String spec;

    @Builder
    public Item(Supplier supplier, String code, String name, ItemType type,
                String category, boolean serial, String spec) {
        this.supplier = supplier;
        this.code = code;
        this.name = name;
        this.type = type;
        this.category = category;
        this.serial = serial;
        this.spec = spec;
    }
}
