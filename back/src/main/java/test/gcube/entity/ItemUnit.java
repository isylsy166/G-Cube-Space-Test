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
import test.gcube.entity.enums.ItemUnitStatus;

/**
 * 품목 개체. 시리얼 관리 대상 품목만 사용한다.
 * 창고·품목은 {@link Stock} 을 통해 참조한다.
 */
@Entity
@Table(
        name = "item_unit",
        uniqueConstraints = @UniqueConstraint(
                name = "UK_ITEM_UNIT_SERIAL_NUMBER",
                columnNames = "serial_number"
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ItemUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stock_id", nullable = false)
    private Stock stock;

    /** 시리얼 번호 (예: UNIT-Z10-Q-0001) */
    @Column(name = "serial_number", nullable = false, length = 255)
    private String serialNumber;

    /** 보관 위치 (예: A-01-01) */
    @Column(name = "location", length = 255)
    private String location;

    /** 상태 (정상 / 예약 / 판매완료) */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private ItemUnitStatus status;

    /** 배정된 주문. 피킹하면 채워진다. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Orders order;

    @Builder
    public ItemUnit(Stock stock, String serialNumber, String location, ItemUnitStatus status,
                    Orders order) {
        this.stock = stock;
        this.serialNumber = serialNumber;
        this.location = location;
        this.status = status;
        this.order = order;
    }

    /** 다른 주문에 배정되었거나 이미 출고된 개체는 다시 고를 수 없다. (요구사항 3-4) */
    public boolean isPickable() {
        return status == ItemUnitStatus.NORMAL && order == null;
    }

    /** 주문에 배정한다. */
    public void assignTo(Orders order) {
        this.order = order;
        this.status = ItemUnitStatus.RESERVED;
    }

    /** 출고 처리. */
    public void ship() {
        this.status = ItemUnitStatus.SOLD;
    }
}
