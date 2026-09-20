"use client";

import { useId } from "react";
import type { FilterOption } from "./FilterBar";

const STATUS_META: Record<string, { color: string; symbol: string }> = {
  "": { color: "#475569", symbol: "≡" },
  READY: { color: "#047857", symbol: "✓" },
  WAITING: { color: "#a16207", symbol: "◷" },
  SHORTAGE: { color: "#be123c", symbol: "!" },
  REVIEW_REQUIRED: { color: "#6d28d9", symbol: "?" },
};

export function OrderQuery({ date, defaultDate, warehouse, warehouses, statuses, status, loading, error, excludedCount, onDate, onWarehouse, onStatus, onReset, filtered }: {
  date: string;
  defaultDate: string;
  warehouse: string;
  warehouses: FilterOption[];
  statuses: FilterOption[];
  status: string | null;
  loading: boolean;
  error: boolean;
  excludedCount: number;
  onDate: (value: string) => void;
  onWarehouse: (value: string) => void;
  onStatus: (value: string) => void;
  onReset: () => void;
  filtered: boolean;
}) {
  const dateId = useId();
  return (
    <section aria-label="주문 조회" className="rounded-2xl border border-line bg-surface p-5 shadow-[0_2px_8px_rgba(15,23,42,.03)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold">주문 조회</h2>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <select aria-label="배송일 조회 방식" value={date ? "date" : "all"}
            onChange={(event) => onDate(event.target.value === "all" ? "" : defaultDate)}
            className="min-h-10 rounded-lg border border-line bg-surface px-3 text-xs text-ink-soft">
            <option value="all">전체 날짜</option>
            <option value="date">날짜 선택</option>
          </select>
          {date && <input id={dateId} aria-label="배송일 선택" type="date" value={date}
            onChange={(event) => onDate(event.target.value)}
            className="min-h-10 min-w-0 rounded-lg border border-line bg-surface px-3 text-xs text-ink-soft" />}
          <select aria-label="출고창고" value={warehouse} onChange={(event) => onWarehouse(event.target.value)}
            className="min-h-10 max-w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink-soft">
            {warehouses.map((option) => <option key={option.value} value={option.value}>
              {option.value ? option.label : "전체 창고"}
            </option>)}
          </select>
          <button type="button" disabled={!filtered} onClick={onReset}
            className="min-h-10 rounded-lg px-3 text-xs font-medium text-ink-muted enabled:cursor-pointer enabled:hover:bg-canvas disabled:opacity-40">초기화</button>
        </div>
      </div>
      <div role="group" aria-label="준비 상태별 주문 조회" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statuses.map((option) => {
          const selected = option.value === status;
          const meta = STATUS_META[option.value];
          return (
            <button type="button" key={option.value} aria-pressed={selected} onClick={() => onStatus(option.value)}
              className={`relative min-h-[108px] cursor-pointer rounded-xl border p-4 text-left transition-colors ${selected ? "border-[#202530] bg-[#202530] text-white shadow-sm" : "border-line bg-surface text-ink hover:border-slate-400 hover:bg-slate-50"}`}>
              <span className="flex items-center gap-2 text-[13px] font-medium">
                <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-md text-xs font-bold"
                  style={{ color: selected ? "#fff" : meta.color, background: selected ? "#ffffff24" : `${meta.color}14` }}>{meta.symbol}</span>
                {option.label}
              </span>
              <span className="mt-2 block text-[30px] leading-none font-bold tabular-nums">{loading || error ? "—" : option.count}</span>
              {selected && <span aria-hidden className="absolute right-3 bottom-3 text-xs text-white/70">✓ 선택</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">
        {error ? "현황을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." : loading ? "주문 현황을 불러오는 중입니다." : `우선 조치 ${(statuses.find((option) => option.value === "SHORTAGE")?.count ?? 0) + (statuses.find((option) => option.value === "REVIEW_REQUIRED")?.count ?? 0)}건 (재고 부족·확인 필요). 선택한 날짜·창고·검색어 기준입니다. 전체에는 취소·출고·배송 완료 주문 ${excludedCount}건이 포함됩니다.`}
      </p>
    </section>
  );
}
