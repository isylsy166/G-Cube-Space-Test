package test.gcube.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

/**
 * 세트 구성. shipping 이 false 인 구성품(설치·수거 같은 서비스)은 재고 수요에서 빠진다.
 */
@Entity
@Table(
        name = "item_set_component",
        uniqueConstraints = @UniqueConstraint(
                name = "UK_ITEM_SET_COMPONENT",
                columnNames = {"item_set_id", "item_id"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ItemSetComponent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_set_id", nullable = false)
    private ItemSet itemSet;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;

    /** 세트 1개당 구성 수량 */
    @Column(name = "quantity", nullable = false)
    private int quantity;

    /** 출고 대상 여부 */
    @Column(name = "is_shipping", nullable = false)
    private boolean shipping;

    @Builder
    public ItemSetComponent(ItemSet itemSet, Item item, int quantity, boolean shipping) {
        this.itemSet = itemSet;
        this.item = item;
        this.quantity = quantity;
        this.shipping = shipping;
    }
}
