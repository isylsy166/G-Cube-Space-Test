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
import test.gcube.entity.enums.OrderLineStatus;

/**
 * 주문 상세.
 *
 * <p>단품 주문이면 item 이, 세트 주문이면 itemSet 이 채워진다. 둘 중 하나만 값이 있다.
 */
@Entity
@Table(
        name = "order_detail",
        uniqueConstraints = @UniqueConstraint(
                name = "UK_ORDER_DETAIL_SEQUENCE",
                columnNames = {"order_id", "sequence"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OrderDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Orders order;

    /** 단품 주문일 때만 값이 있다. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id")
    private Item item;

    /** 세트 주문일 때만 값이 있다. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_set_id")
    private ItemSet itemSet;

    /** 주문 내 품목 순서 */
    @Column(name = "sequence", nullable = false)
    private int sequence;

    @Column(name = "order_quantity", nullable = false)
    private int orderQuantity;

    /** 품목 상태. 취소된 라인은 기록만 남고 준비 수량에서 빠진다. (요구사항 3-1) */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private OrderLineStatus status;

    @Builder
    public OrderDetail(Orders order, Item item, ItemSet itemSet, int sequence,
                       int orderQuantity, OrderLineStatus status) {
        this.order = order;
        this.item = item;
        this.itemSet = itemSet;
        this.sequence = sequence;
        this.orderQuantity = orderQuantity;
        this.status = status;
    }

    /** 준비 수량에 넣어야 하는 라인인지 */
    public boolean isPreparable() {
        return status == OrderLineStatus.NORMAL;
    }

    /** 세트 주문 여부 */
    public boolean isSetOrder() {
        return itemSet != null;
    }
}
