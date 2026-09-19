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
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * 창고별·품목별 재고. 가용재고는 quantity - bookedQuantity 다.
 */
@Entity
@Table(
        name = "stock",
        uniqueConstraints = @UniqueConstraint(
                name = "UK_STOCK_WAREHOUSE_ITEM",
                columnNames = {"warehouse_id", "item_id"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Stock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_id", nullable = false)
    private Warehouse warehouse;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;

    /** 현재 재고 수량 */
    @Column(name = "quantity", nullable = false)
    private int quantity;

    /** 예약된 재고 수량 */
    @Column(name = "booked_quantity", nullable = false)
    private int bookedQuantity;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    public Stock(Warehouse warehouse, Item item, int quantity, int bookedQuantity) {
        this.warehouse = warehouse;
        this.item = item;
        this.quantity = quantity;
        this.bookedQuantity = bookedQuantity;
    }

    /** 가용재고 */
    public int getAvailableQuantity() {
        return quantity - bookedQuantity;
    }

    /** 예약. 현재고는 그대로 두고 예약수량만 늘린다. (요구사항 3-4) */
    public void reserve(int amount) {
        if (amount > getAvailableQuantity()) {
            throw new IllegalStateException(
                    "가용재고(%d)보다 많이 예약할 수 없습니다. 요청 수량: %d"
                            .formatted(getAvailableQuantity(), amount));
        }
        this.bookedQuantity += amount;
    }

    /** 출고. 현재고와 예약수량을 함께 줄인다. (요구사항 3-4) */
    public void ship(int amount) {
        if (amount > bookedQuantity || amount > quantity) {
            throw new IllegalStateException(
                    "출고 수량이 현재고(%d) 또는 예약수량(%d)을 넘습니다. 요청 수량: %d"
                            .formatted(quantity, bookedQuantity, amount));
        }
        this.quantity -= amount;
        this.bookedQuantity -= amount;
    }

    /** 입고. 현재고를 늘린다. (요구사항 3-5) */
    public void receive(int amount) {
        this.quantity += amount;
    }
}
