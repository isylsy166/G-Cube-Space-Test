package test.gcube.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.FetchType;
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
import org.hibernate.annotations.UpdateTimestamp;
import test.gcube.entity.enums.OrderStatus;

/**
 * 주문. 클래스명이 Orders 인 것은 테이블명(orders)과 맞추고
 * JPQL 예약어 order 와의 혼동을 피하기 위해서다.
 */
@Entity
@Table(
        name = "orders",
        uniqueConstraints = @UniqueConstraint(
                name = "UK_ORDERS_ORDER_NUMBER",
                columnNames = "order_number"
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Orders {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    /** 출고 창고. 이 주문은 이 창고의 재고만 사용한다. (요구사항 3-2) */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_id", nullable = false)
    private Warehouse warehouse;

    /** 주문 번호 (예: ORD202607200001) */
    @Column(name = "order_number", nullable = false, length = 50)
    private String orderNumber;

    /** 주문 상태 (주문 확정 / 취소 / 출고 완료 / 배송 완료) */
    @Enumerated(EnumType.STRING)
    @Column(name = "order_status", nullable = false, length = 30)
    private OrderStatus orderStatus;

    /** 배송 예정일 */
    @Column(name = "delivery_at")
    private LocalDateTime deliveryAt;

    /** 주문 접수 일시 */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    public Orders(Warehouse warehouse, String orderNumber, OrderStatus orderStatus,
                  LocalDateTime deliveryAt) {
        this.warehouse = warehouse;
        this.orderNumber = orderNumber;
        this.orderStatus = orderStatus;
        this.deliveryAt = deliveryAt;
    }

    /** 새 출고 준비 대상인지. 취소·출고완료·배송완료 주문은 제외된다. (요구사항 3-1) */
    public boolean isPreparationTarget() {
        return orderStatus == OrderStatus.CONFIRMED;
    }

    /** 출고 처리. */
    public void ship() {
        this.orderStatus = OrderStatus.SHIPPED;
    }
}
