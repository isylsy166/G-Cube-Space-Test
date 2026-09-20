import type {
  InspectStatus,
  ItemType,
  ItemUnitStatus,
  OrderStatus,
  ReadinessStatus,
  ScheduleType,
} from "./types";

/** 배지 색 한 벌. [글자색, 배경색, 테두리색] */
export type Tone = readonly [fg: string, bg: string, border: string];

export const GREEN: Tone = ["#0B7160", "#E7F4F1", "#C6E4DC"];
export const AMBER: Tone = ["#96590A", "#FBF1DE", "#EDDCB8"];
export const ORANGE: Tone = ["#B23C0B", "#FCEEE6", "#F1D7C6"];
export const INDIGO: Tone = ["#3D40A8", "#ECEEFB", "#D2D6F1"];
export const SLATE: Tone = ["#565C6E", "#F0F1F5", "#DEE1E8"];
export const ROSE: Tone = ["#BE123C", "#FFF1F2", "#FDA4AF"];
export const VIOLET: Tone = ["#6D28D9", "#F5F3FF", "#C4B5FD"];

export const MUTED: Tone = ["#676D80", "#F2F3F6", "#E4E6EC"];

/** 준비 상태별 색. 초록=준비 가능, 황토=입고 대기, 붉은색=재고 부족, 보라=정보 확인, 회색=끝난 주문. */
export const READINESS_TONE: Record<ReadinessStatus, Tone> = {
  READY: GREEN,
  WAIT_INSPECTION: AMBER,
  WAIT_PRODUCTION: AMBER,
  WAIT_PURCHASE: AMBER,
  SHORTAGE: ROSE,
  REVIEW_REQUIRED: VIOLET,
  NOT_APPLICABLE: MUTED,
};

export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  CONFIRMED: INDIGO,
  CANCELED: MUTED,
  SHIPPED: INDIGO,
  DELIVERED: MUTED,
};

export const UNIT_STATUS_TONE: Record<ItemUnitStatus, Tone> = {
  NORMAL: GREEN,
  RESERVED: INDIGO,
  SOLD: MUTED,
};

export const SCHEDULE_TYPE_TONE: Record<ScheduleType, Tone> = {
  PRODUCTION: INDIGO,
  PURCHASE: GREEN,
};

export const ITEM_TYPE_TONE: Record<ItemType, Tone> = {
  MANUFACTURED: INDIGO,
  PURCHASED: GREEN,
  SERVICE: MUTED,
};

export const INSPECT_TONE: Record<InspectStatus, Tone> = {
  NOT_APPLICABLE: MUTED,
  BEFORE_INSPECTION: SLATE,
  WAITING_INSPECTION: AMBER,
  INSPECTED: GREEN,
  REJECTED: ORANGE,
};

/** 준비 상태별 한 줄 설명. 지금 상태가 무슨 뜻인지. */
export const READINESS_HINT: Record<ReadinessStatus, string> = {
  READY: "사용 가능한 재고가 충분합니다. 이 주문에 필요한 수량을 예약하세요.",
  WAIT_INSPECTION: "생산품의 품질검사가 필요합니다. 관련 입고 문서에서 검사 진행 상황을 확인하세요.",
  WAIT_PRODUCTION: "생산 중인 품목이 있습니다. 관련 입고 문서에서 생산 및 입고 일정을 확인하세요.",
  WAIT_PURCHASE: "구매한 품목의 입고를 기다리고 있습니다. 관련 입고 문서에서 도착 예정일을 확인하세요.",
  SHORTAGE: "예정된 입고 수량을 포함해도 재고가 부족합니다. 아래 부족 품목을 확인하고 발주하세요.",
  REVIEW_REQUIRED: "주문 정보에 확인이 필요한 항목이 있습니다. 아래 사유를 확인하세요.",
  NOT_APPLICABLE: "취소되었거나 출고·배송이 끝난 주문입니다. 새로 준비할 것이 없습니다.",
};

/** 담당자가 지금 해야 할 일. 상태 배지 옆에 그대로 붙인다. */
export const READINESS_ACTION: Record<ReadinessStatus, string> = {
  READY: "재고를 예약해 주세요",
  WAIT_INSPECTION: "품질검사 진행 확인",
  WAIT_PRODUCTION: "생산 일정 확인",
  WAIT_PURCHASE: "입고 일정 확인",
  SHORTAGE: "부족 품목 발주",
  REVIEW_REQUIRED: "주문 정보 확인",
  NOT_APPLICABLE: "처리할 것 없음",
};
