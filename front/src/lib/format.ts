/** 백엔드는 LocalDateTime 을 "2026-07-21T09:00:00" 으로 내려준다. 타임존 변환 없이 문자열로 다룬다. */

export const toDate = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "—");

export const toDateTime = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 16).replace("T", " ") : "—";

/** 증감 표기. 0 은 수량이 안 움직였다는 뜻이라 가운뎃점으로 둔다. */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? String(n) : "·");

export const deltaColor = (n: number) =>
  n > 0 ? "#0E7C66" : n < 0 ? "#C2410C" : "#8A8A99";

export const pct = (received: number, plan: number) =>
  plan <= 0 ? 0 : Math.min(100, Math.round((received / plan) * 100));
