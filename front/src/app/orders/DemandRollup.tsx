"use client";

import Link from "next/link";
import { useMemo } from "react";
import { dateWithWeekday, ddayColor, ddayLabel } from "@/lib/basetime";
import { Card, CardHeader, EmptyRow, GroupHeader } from "@/components/ui";
import type { OrderSummary } from "@/lib/types";

const COLS = "96px minmax(150px,1fr) 64px 72px 78px 64px minmax(140px,0.9fr)";
const MIN_WIDTH = 720;

type Row = {
  itemCode: string;
  itemName: string;
  required: number;
  fromStock: number;
  fromSchedule: number;
  shortage: number;
  orders: string[];
};

type DateGroup = {
  date: string;
  orderCount: number;
  rows: Row[];
  totalRequired: number;
  totalShortage: number;
};

/**
 * "배송일별로 실제 준비해야 할 품목과 수량은 얼마인가"에 답하는 표.
 * 주문별 세트 전개 결과(준비 수요)를 배송일 → 품목 순으로 합산한다.
 * 확인이 필요한 주문은 준비 대상이 아니므로 애초에 수요가 비어 있다.
 */
export function DemandRollup({ orders }: { orders: OrderSummary[] }) {
  // 목록 응답이 세트 전개 결과(demands)까지 함께 준다. 주문마다 상세를 다시 부르면
  // 그 한 건이 서버에서 전역 판정을 한 번씩 더 돌린다.
  const data = useMemo(() => orders.filter((o) => o.preparationTarget), [orders]);

  const groups = useMemo<DateGroup[]>(() => {
    const byDate = new Map<string, { orders: Set<string>; items: Map<string, Row> }>();

    for (const d of data) {
      const date = d.deliveryAt.slice(0, 10);
      const g = byDate.get(date) ?? { orders: new Set<string>(), items: new Map<string, Row>() };
      g.orders.add(d.orderNumber);
      for (const n of d.demands) {
        const row = g.items.get(n.itemCode) ?? {
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
        row.orders.push(d.orderNumber);
        g.items.set(n.itemCode, row);
      }
      byDate.set(date, g);
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, g]) => {
        // 부족한 품목이 위로. 그다음은 많이 필요한 순.
        const rows = [...g.items.values()].sort(
          (a, b) => b.shortage - a.shortage || b.required - a.required,
        );
        return {
          date,
          orderCount: g.orders.size,
          rows,
          totalRequired: rows.reduce((s, r) => s + r.required, 0),
          totalShortage: rows.reduce((s, r) => s + r.shortage, 0),
        };
      })
      .filter((g) => g.rows.length > 0);
  }, [data]);

  const total = useMemo(
    () => ({
      required: groups.reduce((s, g) => s + g.totalRequired, 0),
      shortage: groups.reduce((s, g) => s + g.totalShortage, 0),
      kinds: new Set(groups.flatMap((g) => g.rows.map((r) => r.itemCode))).size,
    }),
    [groups],
  );

  return (
    <Card>
      <CardHeader
        title="배송일별 준비 품목"
        desc="배송일별로 준비할 품목과 수량입니다. 세트 구성품을 포함하며, 서비스와 취소 품목은 제외합니다."
        right={
          groups.length > 0 && (
            <span className="flex items-center gap-3 text-xs">
              <Total label="품목" value={total.kinds} />
              <Total label="총 필요" value={total.required} />
              <Total label="총 부족" value={total.shortage} tone="var(--color-bad)" />
            </span>
          )
        }
      />

      {groups.length === 0 ? (
        <EmptyRow>이 조건에는 준비할 재고 품목이 없습니다.</EmptyRow>
      ) : (
        <div className="table-scroll">
          <div style={{ minWidth: MIN_WIDTH }}>
            {groups.map((g) => (
              <section key={g.date}>
                <GroupHeader
                  title={dateWithWeekday(g.date)}
                  meta={
                    <span style={{ color: ddayColor(g.date) }} className="font-semibold">
                      {ddayLabel(g.date)}
                    </span>
                  }
                >
                  <span className="text-xs text-ink-faint">
                    주문 <strong className="num font-bold text-ink-soft">{g.orderCount}</strong>건 ·
                    품목 <strong className="num font-bold text-ink-soft">{g.rows.length}</strong>종 ·
                    수량 <strong className="num font-bold text-ink-soft">{g.totalRequired}</strong>
                    {g.totalShortage > 0 && (
                      <>
                        {" · "}
                        <strong className="num font-bold text-bad">부족 {g.totalShortage}</strong>
                      </>
                    )}
                  </span>
                </GroupHeader>

                <div
                  className="grid gap-3 border-b border-line-soft bg-raised px-4 py-2 text-[11px] font-bold text-ink-faint"
                  style={{ gridTemplateColumns: COLS }}
                >
                  <div>품목코드</div>
                  <div>품목명</div>
                  <div className="text-right">필요</div>
                  <div className="text-right">현재고로</div>
                  <div className="text-right">입고예정으로</div>
                  <div className="text-right">부족</div>
                  <div>관련 주문</div>
                </div>

                {g.rows.map((r) => (
                  <div
                    key={r.itemCode}
                    className="grid items-center gap-3 border-b border-line-soft px-4 py-2.5"
                    style={{
                      gridTemplateColumns: COLS,
                      background: r.shortage > 0 ? "var(--color-row-bad)" : undefined,
                    }}
                  >
                    <Link
                      href={`/items?code=${r.itemCode}`}
                      className="num text-xs font-semibold text-accent hover:underline"
                    >
                      {r.itemCode}
                    </Link>
                    <div className="truncate text-[13px]">{r.itemName}</div>
                    <div className="num text-right text-[15px] font-bold">{r.required}</div>
                    <div className="num text-right text-[13px] font-semibold text-good">
                      {r.fromStock || "—"}
                    </div>
                    <div className="num text-right text-[13px] font-semibold text-warn">
                      {r.fromSchedule || "—"}
                    </div>
                    <div
                      className="num text-right text-[13px] font-bold"
                      style={{ color: r.shortage > 0 ? "var(--color-bad)" : "var(--color-ink-ghost)" }}
                    >
                      {r.shortage || "—"}
                    </div>
                    <div className="truncate text-xs text-ink-faint" title={r.orders.join(", ")}>
                      <span className="num">{r.orders[0]}</span>
                      {r.orders.length > 1 && ` 외 ${r.orders.length - 1}건`}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Total({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-[11px] text-ink-dim">{label}</span>
      <span className="num text-[15px] font-bold" style={{ color: tone ?? "var(--color-ink)" }}>
        {value}
      </span>
    </span>
  );
}
