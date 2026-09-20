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

    /**
     * 검사를 통과한 수량. 생산의뢰만 쓴다. 입고는 이 수량까지만 허용한다.
     * 검사 전에는 0 이며, 이 값이 0 인 생산의뢰는 한 개도 입고할 수 없다.
     */
    @Column(name = "inspected_quantity", nullable = false)
    private int inspectedQuantity;

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
                         int inspectedQuantity, InspectStatus inspectStatus,
                         boolean confirmed, Orders order) {
        this.supplier = supplier;
        this.warehouse = warehouse;
        this.item = item;
        this.code = code;
        this.type = type;
        this.status = status;
        this.planQuantity = planQuantity;
        this.receivedQuantity = receivedQuantity;
        this.availableAt = availableAt;
        this.inspectedQuantity = inspectedQuantity;
        this.inspectStatus = inspectStatus;
        this.confirmed = confirmed;
        this.order = order;
    }

    /**
     * 검사 결과를 기록한다. 통과한 수량만 입고할 수 있다. (요구사항 3-5)
     *
     * <p>검사는 전량 합격/전량 불합격이 아니다. 생산한 물량 중 일부만 합격하는 것이
     * 오히려 흔하다. 그래서 통과 수량을 받아 {@link #inspectedQuantity} 에 기록하고,
     * 입고는 그 수량까지만 허용한다. 나머지는 불합격분이라 현재고가 되지 않는다.
     *
     * <p>통과 수량이 0 이면 전량 불합격이다. 이때 {@code 검사 대기} 로 되돌리지 않고
     * {@link InspectStatus#REJECTED} 로 남긴다. 되돌리면 이미 검사 대기였던 문서에서
     * 불합격이 아무것도 바꾸지 않아, 담당자가 기록이 남았는지 알 수 없다.
     *
     * @param passedQuantity 검사를 통과한 수량. 계획수량을 넘을 수 없다.
     */
    public void inspect(int passedQuantity) {
        if (passedQuantity < 0) {
            throw new IllegalStateException("검사 통과 수량은 0 이상이어야 합니다.");
        }
        if (passedQuantity > planQuantity) {
            throw new IllegalStateException(
                    "검사 통과 수량(%d)이 계획수량(%d)을 넘을 수 없습니다."
                            .formatted(passedQuantity, planQuantity));
        }
        if (passedQuantity < receivedQuantity) {
            // 이미 들어온 물량을 불합격으로 되돌릴 수는 없다. 입고를 취소하는 기능이 아니다.
            throw new IllegalStateException(
                    "이미 %d 개가 입고되어 통과 수량을 %d 개로 낮출 수 없습니다."
                            .formatted(receivedQuantity, passedQuantity));
        }

        this.inspectedQuantity = passedQuantity;
        if (passedQuantity == 0) {
            this.inspectStatus = InspectStatus.REJECTED;
            if (this.status == ScheduleStatus.INSPECTED) {
                this.status = ScheduleStatus.PRODUCED;
            }
            return;
        }
        this.inspectStatus = InspectStatus.INSPECTED;
        if (this.status != ScheduleStatus.PARTIAL_RECEIVED
                && this.status != ScheduleStatus.RECEIVED) {
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
        if (quantity > getReceivableQuantity()) {
            // 생산의뢰에서 검사를 통과하지 않은 물량. 계획수량 안이어도 들어올 수 없다.
            throw new IllegalStateException(
                    "검사를 통과한 %d 개 중 %d 개가 이미 입고되어 %d 개까지만 입고할 수 있습니다. 요청 수량: %d"
                            .formatted(inspectedQuantity, receivedQuantity,
                                    getReceivableQuantity(), quantity));
        }
        this.receivedQuantity += quantity;
        this.status = getRemainingQuantity() == 0
                ? ScheduleStatus.RECEIVED
                : ScheduleStatus.PARTIAL_RECEIVED;
    }

    /**
     * 준비 판단(요구사항 3-2)에 쓸 수 있는 문서인지.
     * 미확정, 사용 중지된 창고, 남은 수량 없음, 사용 가능 예정일 미정,
     * 그리고 검사 불합격 물량은 앞으로 들어올 수량으로 보지 않는다.
     */
    public boolean isUsableForPlanning() {
        return confirmed
                && warehouse.isActive()
                && getUsableQuantity() > 0
                && availableAt != null
                && inspectStatus != InspectStatus.REJECTED;
    }

    /**
     * 앞으로 실제로 들어올 수 있는 수량. 준비 판단은 이 값을 쓴다.
     *
     * <p>검사를 마친 생산의뢰는 통과한 만큼만 들어온다. 남은 계획수량이 아니라
     * 불합격분을 뺀 수량을 세야 한다. 그러지 않으면 들어오지 않을 물량을 기다리며
     * 주문이 '생산 완료 대기' 로 남고, 담당자는 발주해야 할 시점을 놓친다.
     */
    public int getUsableQuantity() {
        if (inspectStatus == InspectStatus.REJECTED) {
            return 0;  // 불합격 물량은 들어오지 않는다
        }
        if (type == ScheduleType.PRODUCTION && inspectStatus == InspectStatus.INSPECTED) {
            return Math.max(0, inspectedQuantity - receivedQuantity);
        }
        return getRemainingQuantity();
    }

    /** 지금 입고할 수 있는 수량. 생산의뢰는 검사를 통과한 만큼으로 막힌다. */
    public int getReceivableQuantity() {
        if (type != ScheduleType.PRODUCTION) {
            return getRemainingQuantity();
        }
        return Math.max(0, Math.min(getRemainingQuantity(), inspectedQuantity - receivedQuantity));
    }

    /** 생산의뢰는 검사를 통과해야 입고할 수 있다. */
    public boolean isReceivable() {
        if (!confirmed || getRemainingQuantity() == 0) {
            return false;
        }
        if (type != ScheduleType.PRODUCTION) {
            return true;
        }
        return inspectStatus == InspectStatus.INSPECTED && getReceivableQuantity() > 0;
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
