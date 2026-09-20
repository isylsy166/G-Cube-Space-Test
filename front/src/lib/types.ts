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
  kind: "SET" | "ITEM";
  code: string;
  name: string;
  orderQuantity: number;
  status: OrderLineStatus;
  statusLabel: string;
  components: SetComponent[];
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
}

export interface Reservation {
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
}
