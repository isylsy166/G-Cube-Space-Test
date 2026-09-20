import { BASE_DATE } from "./basetime";

export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 서버와 동일한 기준일 + 공급 소요 일수. 배송 전날까지 사용 가능해야 한다. */
export function purchaseTiming(deliveryAt: string, leadTimeDays: number | undefined) {
  const deadline = shiftDate(deliveryAt, -1);
  if (leadTimeDays === undefined || !Number.isInteger(leadTimeDays) || leadTimeDays < 0)
    return { deadline, availableAt: null, onTime: null };
  const availableAt = shiftDate(BASE_DATE, leadTimeDays);
  return { deadline, availableAt, onTime: availableAt <= deadline };
}

export function reviewRecipient(reason: string): string {
  if (/창고/.test(reason)) return "영업 · 출고창고 변경 요청";
  if (/미등록|등록되지|등록되어 있지|존재하지.*품목/.test(reason)) return "상품팀 · 품목코드 확인 요청";
  if (/수량/.test(reason)) return "CS · 원 주문 수량 확인 요청";
  return "영업·CS · 주문 정보 확인 요청";
}
