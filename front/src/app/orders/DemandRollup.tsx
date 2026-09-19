"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useOrderDetails } from "@/lib/hooks";
import type { OrderSummary } from "@/lib/types";

/**
 * "이 범위에서 실제로 준비해야 할 품목과 수량은 얼마인가"에 답하는 표.
 * 주문별 세트 전개 결과(준비 수요)를 품목 단위로 합산한다.
 * 확인이 필요한 주문은 준비 대상이 아니므로 애초에 수요가 비어 있다.
 */
export function DemandRollup({ orders }: { orders: OrderSummary[] }) {
  // 판정 대상인 주문만 상세를 받는다. 취소·출고완료 주문은 준비 수요가 없다.
  const targets = useMemo(
    () => orders.filter((o) => o.preparationTarget).map((o) => o.orderNumber),
    [orders],
  );
  const { data, isLoading, error } = useOrderDetails(targets);

  const rows = useMemo(() => {
    if (!data) return [];
    const byItem = new Map<
      string,
      {
        itemCode: string;
        itemName: string;
        required: number;
        fromStock: number;
        fromSchedule: number;
        shortage: number;
        orders: string[];
      }
    >();
    for (const d of data) {
      for (const n of d.readiness.demands) {
        const row = byItem.get(n.itemCode) ?? {
          itemCode: n.itemCode,
          itemName: n.itemName,
          required: 0,
          fromStock: 0,
          fromSchedule: 0,
          shortage: 0,
          orders: [],
        };
        row.required += n.requiredQuantity;
        row.fromStock += n.fromStock;
        row.fromSchedule += n.fromSchedule;
        row.shortage += n.shortageQuantity;
        row.orders.push(d.order.orderNumber);
        byItem.set(n.itemCode, row);
      }
    }
    // 부족한 품목이 위로. 그다음은 많이 필요한 순.
    return [...byItem.values()].sort(
      (a, b) => b.shortage - a.shortage || b.required - a.required,
    );
  }, [data]);

  if (error)
    return <Note>준비 품목을 계산하지 못했습니다. 잠시 후 다시 시도해 주세요.</Note>;
  if (isLoading) return <Note>준비 품목을 계산하는 중…</Note>;
  if (rows.length === 0)
    return <Note>이 범위에는 준비할 재고 품목이 없습니다.</Note>;

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-[--color-line] bg-[--color-surface]">
      <div className="flex items-baseline gap-2 border-b border-[--color-line] bg-[#fcfcfd] px-4 py-2.5">
        <h3 className="text-xs font-semibold">이 범위에서 준비할 품목</h3>
        <p className="text-[11px] text-[--color-ink-dim]">
          세트를 구성품으로 전개하고 서비스·취소 품목을 뺀 뒤, 주문 {targets.length}건의 수요를
          품목별로 합산했습니다.
        </p>
      </div>

      <div className="table-scroll">
        <div className="min-w-[620px]">
          <div className="grid grid-cols-[88px_minmax(130px,1fr)_60px_60px_72px_64px_minmax(120px,1fr)] gap-2.5 border-b border-[#f1f1f5] px-4 py-2 text-[10.5px] font-semibold tracking-[0.05em] text-[--color-ink-ghost]">
            <div>품목코드</div>
            <div>품목명</div>
            <div className="text-right">필요</div>
            <div className="text-right">현재고</div>
            <div className="text-right">입고예정</div>
            <div className="text-right">부족</div>
            <div>관련 주문</div>
          </div>
          {rows.map((r) => (
            <div
              key={r.itemCode}
              className="grid grid-cols-[88px_minmax(130px,1fr)_60px_60px_72px_64px_minmax(120px,1fr)] items-center gap-2.5 border-b border-[--color-line-soft] px-4 py-2"
              style={{ background: r.shortage > 0 ? "var(--color-bad-wash)" : undefined }}
            >
              <Link
                href={`/items?code=${r.itemCode}`}
                className="font-mono text-[11px] text-[--color-accent] hover:underline"
              >
                {r.itemCode}
              </Link>
              <div className="truncate text-xs">{r.itemName}</div>
              <div className="text-right font-mono text-xs font-semibold">{r.required}</div>
              <div className="text-right font-mono text-xs text-[--color-good]">
                {r.fromStock}
              </div>
              <div className="text-right font-mono text-xs text-[--color-warn]">
                {r.fromSchedule || "—"}
              </div>
              <div
                className="text-right font-mono text-xs font-semibold"
                style={{ color: r.shortage > 0 ? "var(--color-bad)" : "var(--color-ink-ghost)" }}
              >
                {r.shortage || "—"}
              </div>
              <div className="truncate text-[11px] text-[--color-ink-dim]" title={r.orders.join(", ")}>
                {r.orders.length}건 · {r.orders[0]}
                {r.orders.length > 1 && ` 외 ${r.orders.length - 1}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-xl border border-[--color-line] bg-[--color-surface] px-4 py-3 text-xs text-[--color-ink-dim]">
      {children}
    </div>
  );
}
