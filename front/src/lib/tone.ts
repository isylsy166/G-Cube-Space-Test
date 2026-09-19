import type {
  InspectStatus,
  ItemType,
  ItemUnitStatus,
  OrderStatus,
  ReadinessStatus,
  ScheduleType,
} from "./types";

/** 배지 색 한 쌍. [글자색, 배경색] */
export type Tone = readonly [fg: string, bg: string];

const GREEN: Tone = ["#0E7C66", "#E9F5F1"];
const AMBER: Tone = ["#A4600B", "#FBF2E4"];
const ORANGE: Tone = ["#C2410C", "#FCEEE7"];
const INDIGO: Tone = ["#4C4F8A", "#EDEEF6"];
const GRAY: Tone = ["#6B6B7B", "#F2F2F5"];
const MUTED: Tone = ["#8A8A99", "#F2F2F5"];

/** 준비 상태별 색. 초록=바로 가능, 노랑=기다리는 중, 주황=발주 필요, 회색=사람이 볼 것. */
export const READINESS_TONE: Record<ReadinessStatus, Tone> = {
  READY: GREEN,
  WAIT_INSPECTION: AMBER,
  WAIT_PRODUCTION: AMBER,
  WAIT_PURCHASE: AMBER,
  SHORTAGE: ORANGE,
  REVIEW_REQUIRED: GRAY,
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
  BEFORE_INSPECTION: GRAY,
  WAITING_INSPECTION: AMBER,
  INSPECTED: GREEN,
  REJECTED: ORANGE,
};

/** 주문 상세의 사유 박스 색. [글자색, 배경색, 테두리색] */
export function reasonTone(status: ReadinessStatus): [string, string, string] {
  switch (status) {
    case "SHORTAGE":
      return ["#C2410C", "#FEF8F4", "#F4DDD0"];
    case "REVIEW_REQUIRED":
      return ["#5B5B6B", "#F7F7FA", "#ECECF2"];
    case "READY":
      return ["#0E7C66", "#F2FAF7", "#D9EDE6"];
    default:
      return ["#A4600B", "#FDF9F1", "#F1E3CD"];
  }
}

/** 준비 상태별 한 줄 설명. 담당자가 다음에 뭘 해야 하는지로 적는다. */
export const READINESS_HINT: Record<ReadinessStatus, string> = {
  READY: "현재고만으로 전량 준비됩니다. 바로 예약할 수 있습니다.",
  WAIT_INSPECTION: "품질검사를 통과해야 쓸 수 있는 입고예정을 기다리는 중입니다.",
  WAIT_PRODUCTION: "생산이 끝나야 쓸 수 있는 입고예정을 기다리는 중입니다.",
  WAIT_PURCHASE: "구매 입고를 기다리는 중입니다. 입고되면 곧바로 재판정됩니다.",
  SHORTAGE: "입고예정까지 더해도 수량을 채울 수 없습니다. 발주 또는 생산의뢰가 필요합니다.",
  REVIEW_REQUIRED: "자동으로 처리할 수 없는 주문입니다. 담당자 확인이 필요합니다.",
};
