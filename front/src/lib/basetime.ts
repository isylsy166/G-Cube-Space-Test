/**
 * 업무 기준시각. 백엔드 application.yaml 의 app.base-time 과 같은 값이어야 한다.
 * 서버가 고정 시계를 쓰므로 화면도 실제 오늘이 아니라 이 날짜를 기준으로 남은 일수를 센다.
 */
export const BASE_DATE = "2026-07-21";
export const BASE_TIME_LABEL = "2026-07-21 09:00";

const DAY = 86400000;

/** 기준일로부터 며칠 뒤인지. 시간대에 밀리지 않도록 UTC 자정끼리 뺀다. */
export function daysFromBase(iso: string): number {
  const target = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  const base = Date.parse(`${BASE_DATE}T00:00:00Z`);
  return Math.round((target - base) / DAY);
}

/** 배송까지 남은 일수 표기. 지난 건은 지연으로 드러낸다. */
export function ddayLabel(iso: string): string {
  const d = daysFromBase(iso);
  if (d === 0) return "오늘";
  if (d === 1) return "내일";
  if (d < 0) return `${-d}일 지남`;
  return `D-${d}`;
}

/** 임박할수록 진하게. 지난 배송일은 경고색. */
export function ddayColor(iso: string): string {
  const d = daysFromBase(iso);
  if (d < 0) return "var(--color-bad)";
  if (d <= 1) return "var(--color-warn)";
  return "var(--color-ink-dim)";
}

/** "2026-07-22 (수)" 처럼 요일까지. 날짜 그룹 머리글에 쓴다. */
export function dateWithWeekday(iso: string): string {
  const date = iso.slice(0, 10);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(`${date}T00:00:00Z`).getUTCDay()
  ];
  return `${date} (${wd})`;
}
