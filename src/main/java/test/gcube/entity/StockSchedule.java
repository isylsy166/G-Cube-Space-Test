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
import test.gcube.entity.enums.InspectStatus;
import test.gcube.entity.enums.ScheduleStatus;
import test.gcube.entity.enums.ScheduleType;

/**
 * 입고 예정 (구매발주 / 생산의뢰).
 * 아직 들어오지 않은 수량은 planQuantity - receivedQuantity 이며,
 * receivedQuantity 는 이미 {@link Stock} 에 반영된 값이다.
 */
@Entity
@Table(name = "stock_schedule")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StockSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    /** 입고 창고 */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_id", nullable = false)
    private Warehouse warehouse;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;

    /** 문서 번호 (예: PO-20260719-DMN) */
    @Column(name = "code", length = 50)
    private String code;

    /** 유형 (생산 / 구매) */
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private ScheduleType type;

    /** 진행 상태 (작성 중 / 발주 확정 / 진행 중 / 부분 입고 / 입고 완료 ...) */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30)
    private ScheduleStatus status;

    /** 계획 수량 */
    @Column(name = "plan_quantity", nullable = false)
    private int planQuantity;

    /** 입고 수량 */
    @Column(name = "received_quantity", nullable = false)
    private int receivedQuantity;

    /** 사용 가능 예정일 */
    @Column(name = "available_at")
    private LocalDateTime availableAt;

    /** 검사 상태 (해당 없음 / 검사 전 / 검사 대기 / 검사 완료) */
    @Enumerated(EnumType.STRING)
    @Column(name = "inspect_status", nullable = false, length = 30)
    private InspectStatus inspectStatus;

    /** 확정 여부 */
    @Column(name = "is_confirmed", nullable = false)
    private boolean confirmed;

    /** 이 문서를 만들게 한 주문. 앱에서 만든 발주만 채워진다. (요구사항 3-5) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Orders order;

    @Builder
    public StockSchedule(Supplier supplier, Warehouse warehouse, Item item, String code,
                         ScheduleType type, ScheduleStatus status, int planQuantity,
                         int receivedQuantity, LocalDateTime availableAt,
                         InspectStatus inspectStatus, boolean confirmed, Orders order) {
        this.supplier = supplier;
        this.warehouse = warehouse;
        this.item = item;
        this.code = code;
        this.type = type;
        this.status = status;
        this.planQuantity = planQuantity;
        this.receivedQuantity = receivedQuantity;
        this.availableAt = availableAt;
        this.inspectStatus = inspectStatus;
        this.confirmed = confirmed;
        this.order = order;
    }

    /** 검사 결과를 기록한다. 통과해야 입고할 수 있다. (요구사항 3-5) */
    public void inspect(boolean passed) {
        this.inspectStatus = passed ? InspectStatus.INSPECTED : InspectStatus.WAITING_INSPECTION;
        if (passed) {
            this.status = ScheduleStatus.INSPECTED;
        }
    }

    /**
     * 입고 처리. 누적 입고수량은 계획수량을 넘을 수 없다.
     *
     * @throws IllegalStateException 남은 수량보다 많이 입고하려 할 때
     */
    public void receive(int quantity) {
        if (quantity <= 0) {
            throw new IllegalStateException("입고 수량은 1 이상이어야 합니다.");
        }
        if (quantity > getRemainingQuantity()) {
            throw new IllegalStateException(
                    "남은 수량(%d)보다 많이 입고할 수 없습니다. 요청 수량: %d"
                            .formatted(getRemainingQuantity(), quantity));
        }
        this.receivedQuantity += quantity;
        this.status = getRemainingQuantity() == 0
                ? ScheduleStatus.RECEIVED
                : ScheduleStatus.PARTIAL_RECEIVED;
    }

    /** 생산의뢰는 검사를 통과해야 입고할 수 있다. */
    public boolean isReceivable() {
        if (!confirmed || getRemainingQuantity() == 0) {
            return false;
        }
        return type != ScheduleType.PRODUCTION || inspectStatus == InspectStatus.INSPECTED;
    }

    public void confirm() {
        this.confirmed = true;
        if (this.status == ScheduleStatus.DRAFT) {
            this.status = ScheduleStatus.CONFIRMED;
        }
    }

    /** 앞으로 들어올 수량 */
    public int getRemainingQuantity() {
        return planQuantity - receivedQuantity;
    }
}
