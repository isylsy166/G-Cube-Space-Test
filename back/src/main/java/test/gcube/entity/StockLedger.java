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
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import test.gcube.entity.enums.LedgerType;

/**
 * 재고가 바뀐 기록. 변화량과 변화 후 값을 함께 남겨 사후에 재계산 없이 추적할 수 있게 한다.
 */
@Entity
@Table(name = "stock_ledger")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StockLedger {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stock_id", nullable = false)
    private Stock stock;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Orders order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_schedule_id")
    private StockSchedule stockSchedule;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 30)
    private LedgerType type;

    @Column(name = "quantity_delta", nullable = false)
    private int quantityDelta;

    @Column(name = "booked_delta", nullable = false)
    private int bookedDelta;

    @Column(name = "quantity_after", nullable = false)
    private int quantityAfter;

    @Column(name = "booked_after", nullable = false)
    private int bookedAfter;

    @Column(name = "memo", length = 255)
    private String memo;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public StockLedger(Stock stock, Orders order, StockSchedule stockSchedule, LedgerType type,
                       int quantityDelta, int bookedDelta, String memo) {
        this.stock = stock;
        this.order = order;
        this.stockSchedule = stockSchedule;
        this.type = type;
        this.quantityDelta = quantityDelta;
        this.bookedDelta = bookedDelta;
        this.quantityAfter = stock.getQuantity();
        this.bookedAfter = stock.getBookedQuantity();
        this.memo = memo;
    }
}
