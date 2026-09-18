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
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import test.gcube.entity.enums.ReservationStatus;

/**
 * 한 주문이 어느 재고에서 몇 개를 잡아두었는지. {@link Stock#getBookedQuantity()} 의 내역이다.
 *
 * <p>(주문, 품목) UNIQUE 제약이 같은 예약 요청의 중복 반영을 막는다.
 */
@Entity
@Table(
        name = "order_reservation",
        uniqueConstraints = @UniqueConstraint(
                name = "UK_ORDER_RESERVATION_ORDER_ITEM",
                columnNames = {"order_id", "item_id"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OrderReservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Orders order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stock_id", nullable = false)
    private Stock stock;

    @Column(name = "quantity", nullable = false)
    private int quantity;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private ReservationStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public OrderReservation(Orders order, Item item, Stock stock, int quantity) {
        this.order = order;
        this.item = item;
        this.stock = stock;
        this.quantity = quantity;
        this.status = ReservationStatus.RESERVED;
    }

    /** 출고 처리되면 예약이 소비된다. */
    public void ship() {
        this.status = ReservationStatus.SHIPPED;
    }
}
