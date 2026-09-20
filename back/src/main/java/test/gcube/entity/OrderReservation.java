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
 *
 * <p>{@code order} 가 비어 있는 행은 기준시각에 이미 잡혀 있던 예약이다. 앱이 모르는
 * 주문이라 {@link Orders} 를 만들 수 없지만, 그렇다고 버리면 "이 예약수량을 누가 잡고
 * 있는지" 를 화면에서 답할 수 없다. 그래서 보유자를 {@link #externalReference} 에 남긴다.
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

    /** 앱이 처리한 예약만 값이 있다. 기준시각 이전 예약은 비어 있다. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Orders order;

    /** 앱 밖에서 잡은 예약의 주문번호. {@link #order} 가 비어 있을 때만 값이 있다. */
    @Column(name = "external_reference", length = 50)
    private String externalReference;

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
    public OrderReservation(Orders order, String externalReference, Item item, Stock stock,
                            int quantity) {
        this.order = order;
        this.externalReference = externalReference;
        this.item = item;
        this.stock = stock;
        this.quantity = quantity;
        this.status = ReservationStatus.RESERVED;
    }

    /** 출고 처리되면 예약이 소비된다. */
    public void ship() {
        this.status = ReservationStatus.SHIPPED;
    }

    /** 화면에 보여 줄 예약 보유자. 앱 밖에서 잡은 것이면 그 번호를 준다. */
    public String holderOrderNumber() {
        return order != null ? order.getOrderNumber() : externalReference;
    }

    /** 이 앱이 처리한 예약인지. 아니면 기준시각 이전에 이미 잡혀 있던 것이다. */
    public boolean isManagedHere() {
        return order != null;
    }
}
