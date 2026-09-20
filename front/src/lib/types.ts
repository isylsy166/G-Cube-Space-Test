/**
 * 백엔드 DTO(test.gcube.dto)와 1:1로 맞춘 타입.
 * 서버가 enum 을 name + label 두 벌로 내려주므로, 코드 비교는 name 으로 하고 화면에는 label 을 쓴다.
 */

export type OrderStatus = "CONFIRMED" | "CANCELED" | "SHIPPED" | "DELIVERED";

export type ReadinessStatus =
  | "READY"
  | "WAIT_INSPECTION"
  | "WAIT_PRODUCTION"
  | "WAIT_PURCHASE"
  | "SHORTAGE"
  | "REVIEW_REQUIRED"
  | "NOT_APPLICABLE";

export type ScheduleType = "PURCHASE" | "PRODUCTION";

export type ScheduleStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "PRODUCED"
  | "INSPECTED"
  | "PARTIAL_RECEIVED"
  | "RECEIVED";

export type InspectStatus =
  | "NOT_APPLICABLE"
  | "BEFORE_INSPECTION"
  | "WAITING_INSPECTION"
  | "INSPECTED"
  | "REJECTED";

export type ItemType = "MANUFACTURED" | "PURCHASED" | "SERVICE";
export type ItemUnitStatus = "NORMAL" | "RESERVED" | "SOLD";
export type OrderLineStatus = "NORMAL" | "CANCELED";
export type ReservationStatus = "RESERVED" | "SHIPPED";
export type LedgerType = "RESERVE" | "RELEASE" | "SHIP" | "RECEIVE";

export interface ItemSummary {
  code: string;
  name: string;
  category: string;
  type: ItemType;
  typeLabel: string;
  serial: boolean;
  spec: string | null;
  supplierCode: string;
  supplierName: string;
  leadTimeDays?: number;
  quantity: number;
  bookedQuantity: number;
  availableQuantity: number;
  /** 사용 중지된 창고에 잠겨 있는 수량. 준비 판단에서는 제외된다. */
  inactiveWarehouseQuantity: number;
}

export interface WarehouseStock {
  warehouseCode: string;
  warehouseName: string;
  active: boolean;
  quantity: number;
  bookedQuantity: number;
  availableQuantity: number;
}

export interface ItemUnit {
  serialNumber: string;
  warehouseCode: string;
  location: string | null;
  status: ItemUnitStatus;
  statusLabel: string;
  onHand: boolean;
  assignedOrderNumber: string | null;
  /** 앱 밖에서 잡힌 개체. 주문 상세로 넘어갈 수 없어 링크를 걸지 않는다. */
  assignedOutside: boolean;
}

/** 이 재고의 예약수량을 누가 잡고 있는지. 기준시각 이전 예약도 포함한다. */
export interface StockHolder {
  orderNumber: string;
  managedHere: boolean;
  warehouseCode: string;
  quantity: number;
}

/** 여러 주문의 부족분을 한 문서로 묶는 요청. (요구사항 4-5) */
export interface BulkScheduleCreateRequest {
  orderNumbers: string[];
  itemCode: string;
  quantity?: number;
  supplierCode?: string;
  availableAt?: string;
}

export interface Supplier {
  code: string;
  name: string;
  type: string;
  typeLabel: string;
  leadTimeDays: number;
}

export interface WaitingOrder {
  orderNumber: string;
  warehouseCode: string;
  deliveryAt: string;
  readinessStatus: ReadinessStatus;
  readinessStatusLabel: string;
  requiredQuantity: number;
  shortageQuantity: number;
}

export interface StockLedger {
  type: LedgerType;
  typeLabel: string;
  itemCode: string;
  warehouseCode: string;
  orderNumber: string | null;
  scheduleCode: string | null;
  quantityDelta: number;
  bookedDelta: number;
  quantityAfter: number;
  bookedAfter: number;
  memo: string | null;
  createdAt: string;
}

export interface StockSchedule {
  code: string;
  type: ScheduleType;
  typeLabel: string;
  itemCode: string;
  itemName: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseActive: boolean;
  supplierCode: string;
  supplierName: string;
  leadTimeDays: number;
  planQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  /** 검사를 통과한 수량. 생산의뢰만 의미가 있다. */
  inspectedQuantity: number;
  /** 지금 입고할 수 있는 수량. 생산의뢰는 검사 통과분까지만이다. */
  receivableQuantity: number;
  /** 준비 판단이 세는 수량. 검사를 마친 생산의뢰는 불합격분이 빠진다. */
  usableQuantity: number;
  availableAt: string;
  status: ScheduleStatus | null;
  statusLabel: string | null;
  inspectStatus: InspectStatus;
  inspectStatusLabel: string;
  confirmed: boolean;
  /** 확정 + 검사 통과 등, 준비 판정에 실제로 반영되는 문서인지 */
  usableForPlanning: boolean;
}

export interface ItemDetail {
  item: ItemSummary;
  stocks: WarehouseStock[];
  units: ItemUnit[];
  waitingOrders: WaitingOrder[];
  holders: StockHolder[];
  schedules: StockSchedule[];
  ledgers: StockLedger[];
}

export interface SetComponent {
  itemCode: string;
  itemName: string;
  typeLabel: string;
  serial: boolean;
  quantityPerSet: number;
  requiredQuantity: number;
  /** false 면 준비 수량에서 빠지는 구성품 */
  stockDemand: boolean;
  excludeReason: string | null;
}

export interface OrderLine {
  sequence: number;
  kind: "SET" | "ITEM" | "UNREGISTERED";
  code: string;
  name: string;
  orderQuantity: number;
  status: OrderLineStatus;
  statusLabel: string;
  components: SetComponent[];
  /** 품목으로 등록되지 않은 라인. code 는 주문서에 적혀 있던 원본 코드다. */
  unregistered: boolean;
}

export interface DemandAllocation {
  itemCode: string;
  itemName: string;
  itemType: ItemType;
  itemTypeLabel: string;
  serial: boolean;
  requiredQuantity: number;
  availableQuantity: number;
  /** 현재고에서 채우는 수량 */
  fromStock: number;
  /** 입고예정에서 채우는 수량 */
  fromSchedule: number;
  shortageQuantity: number;
  waitingScheduleCodes: string[];
}

export interface OrderReadiness {
  orderNumber: string;
  warehouseCode: string;
  deliveryAt: string;
  status: ReadinessStatus;
  statusLabel: string;
  demands: DemandAllocation[];
  reviewReasons: string[];
}

export interface OrderSummary {
  orderNumber: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseActive: boolean;
  orderStatus: OrderStatus;
  orderStatusLabel: string;
  deliveryAt: string;
  createdAt: string;
  /** 출고 준비 대상 주문인지 */
  preparationTarget: boolean;
  readinessStatus: ReadinessStatus | null;
  readinessStatusLabel: string | null;
  /**
   * 세트 전개 후 실제 준비 품목. 목록 응답이 이걸 함께 주므로 화면이
   * 주문마다 상세를 다시 부르지 않는다. (상세 1건 = 전역 판정 1회)
   */
  demands: DemandAllocation[];
  reviewReasons: string[];
  /** 재고 예약을 마쳤는지 */
  reserved: boolean;
  /** 시리얼 개체를 배정했는지 */
  picked: boolean;
}

export interface Reservation {
  /** 이 수량을 잡고 있는 주문번호 */
  holderOrderNumber: string;
  /** 이 앱이 처리한 예약인지. false 면 기준시각 이전에 이미 잡혀 있던 예약이다. */
  managedHere: boolean;
  itemCode: string;
  itemName: string;
  warehouseCode: string;
  quantity: number;
  status: ReservationStatus;
  statusLabel: string;
  createdAt: string;
}

/** 직접 선택 화면용. 시리얼 품목의 예약 한 건에 붙는 개체 목록. */
export interface PickableUnits {
  itemCode: string;
  itemName: string;
  warehouseCode: string;
  /** 이 품목으로 예약된 수량. 배정은 이 수량을 넘을 수 없다. */
  reservedQuantity: number;
  assignedQuantity: number;
  /** 더 골라야 하는 개체 수 */
  remainingQuantity: number;
  assignedUnits: ItemUnit[];
  /** 같은 창고에 보관 중이고 아직 어느 주문에도 배정되지 않은 개체 */
  candidates: ItemUnit[];
}

export interface OrderDetail {
  order: OrderSummary;
  lines: OrderLine[];
  readiness: OrderReadiness;
  reservations: Reservation[];
  pickedUnits: ItemUnit[];
  schedules: StockSchedule[];
  ledgers: StockLedger[];
}

export interface ScheduleDetail {
  schedule: StockSchedule;
  sourceOrderNumber: string | null;
  ledgers: StockLedger[];
}

export interface ScheduleCreateRequest {
  itemCode: string;
  /** 생략하면 서버가 주문의 부족 수량으로 채운다. */
  quantity?: number;
  /** 생략하면 품목의 기본 공급처를 쓴다. */
  supplierCode?: string;
  /** YYYY-MM-DD. 생략하면 `기준시각 + 공급처 리드타임`. */
  availableAt?: string;
}
