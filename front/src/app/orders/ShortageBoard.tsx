"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useOrderDetails } from "@/lib/hooks";
import { ddayColor, ddayLabel, dateWithWeekday } from "@/lib/basetime";
import { ROSE } from "@/lib/tone";
import { Callout, Card, CardHeader, EmptyRow } from "@/components/ui";
import { ShortageAction } from "@/components/ShortageAction";
import type { ItemType, OrderSummary } from "@/lib/types";

type Blocked = {
  orderNumber: string;
  deliveryAt: string;
  warehouseName: string;
  warehouseCode: string;
  warehouseActive: boolean;
  shortage: number;
  waitingScheduleCodes: string[];
};

type ItemGroup = {
  itemCode: string;
  itemName: string;
  itemType: ItemType;
  itemTypeLabel: string;
  totalShortage: number;
  blocked: Blocked[];
};

/**
 * "지금 부족한 품목은 무엇을 얼마나 발주해야 하는가"에 답하는 화면.
 * 부족 수량은 주문별로 따로 생기므로, 품목으로 묶어 총량을 보여 주고
 * 발주는 부족을 만든 주문에 걸어 둔다. 그래야 입고됐을 때 어느 주문이 풀리는지가 이어진다.
 */
export function ShortageBoard({ orders }: { orders: OrderSummary[] }) {

  const targets = useMemo(
    () =>
      orders
        .filter((o) => o.preparationTarget && o.readinessStatus === "SHORTAGE")
        .map((o) => o.orderNumber),
    [orders],
  );
  const { data, isLoading, error } = useOrderDetails(targets);

  const groups = useMemo<ItemGroup[]>(() => {
    if (!data) return [];
    const byItem = new Map<string, ItemGroup>();
    for (const d of data) {
      for (const n of d.readiness.demands) {
        if (n.shortageQuantity <= 0) continue;
        const g = byItem.get(n.itemCode) ?? {
          itemCode: n.itemCode,
          itemName: n.itemName,
          itemType: n.itemType,
          itemTypeLabel: n.itemTypeLabel,
          totalShortage: 0,
          blocked: [],
        };
        g.totalShortage += n.shortageQuantity;
        g.blocked.push({
          orderNumber: d.order.orderNumber,
          deliveryAt: d.order.deliveryAt,
          warehouseName: d.order.warehouseName,
          warehouseCode: d.order.warehouseCode,
          warehouseActive: d.order.warehouseActive,
          shortage: n.shortageQuantity,
          waitingScheduleCodes: n.waitingScheduleCodes,
        });
        byItem.set(n.itemCode, g);
      }
    }
    for (const g of byItem.values())
      g.blocked.sort((a, b) => a.deliveryAt.localeCompare(b.deliveryAt));
    return [...byItem.values()].sort((a, b) => b.totalShortage - a.totalShortage);
  }, [data]);

  const totalShortage = groups.reduce((s, g) => s + g.totalShortage, 0);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader
          title="부족분 발주 · 납기 판단"
          desc="필요 기한은 배송 전날입니다. 공급 소요 기간과 비교해 발주 또는 납기 조정을 결정하세요. 발주는 업무 기준일의 소요 기간으로 계산합니다."
          right={
            groups.length > 0 && (
              <span className="flex items-baseline gap-1.5">
                <span className="text-[11px] text-ink-dim">총 부족</span>
                <span className="num text-[17px] font-bold text-bad">{totalShortage}</span>
              </span>
            )
          }
        />

        {error ? (
          <EmptyRow>부족 품목을 계산하지 못했습니다. 잠시 후 다시 시도해 주세요.</EmptyRow>
        ) : isLoading ? (
          <EmptyRow>부족 품목을 계산하는 중…</EmptyRow>
        ) : groups.length === 0 ? (
          <EmptyRow>
            지금 조건에서 발주가 필요한 품목이 없습니다. 재고와 입고예정으로 모두 채워집니다.
          </EmptyRow>
        ) : (
          groups.map((g) => (
            <section key={g.itemCode} className="border-b border-line last:border-b-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-row-bad px-4 py-2.5">
                <Link
                  href={`/items?code=${g.itemCode}`}
                  className="num text-[13px] font-bold text-accent hover:underline"
                >
                  {g.itemCode}
                </Link>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                  {g.itemName}
                </span>
                <span className="rounded-full border border-line bg-surface px-2 py-[2px] text-[11px] font-medium text-ink-faint">
                  {g.itemTypeLabel}
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[11px] text-ink-faint">부족 수량</span>
                  <span className="num text-[17px] font-bold text-bad">{g.totalShortage}</span>
                </span>
              </div>

              <ul>
                {g.blocked.map((b) => (
                  <li
                    key={b.orderNumber}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-soft px-4 py-2.5"
                  >
                    <Link
                      href={`/orders?no=${b.orderNumber}`}
                      className="num w-[118px] flex-none text-xs font-semibold text-accent hover:underline"
                    >
                      {b.orderNumber}
                    </Link>
                    <span
                      className="num w-[58px] flex-none text-xs font-semibold"
                      style={{ color: ddayColor(b.deliveryAt) }}
                      title={dateWithWeekday(b.deliveryAt)}
                    >
                      {ddayLabel(b.deliveryAt)}
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-xs"
                      style={{
                        color: b.warehouseActive ? "var(--color-ink-faint)" : "var(--color-bad)",
                      }}
                    >
                      {b.warehouseName}
                      {!b.warehouseActive && " · 사용 중지"}
                      {b.waitingScheduleCodes.length > 0 && (
                        <span className="text-ink-dim">
                          {" · 대기 중 "}
                          <span className="num">{b.waitingScheduleCodes.join(", ")}</span>
                        </span>
                      )}
                    </span>
                    <span className="num text-[13px] font-bold text-bad">부족 {b.shortage}</span>
                    <ShortageAction itemCode={g.itemCode} orderNumber={b.orderNumber}
                      deliveryAt={b.deliveryAt} warehouseCode={b.warehouseCode}
                      quantity={b.shortage} warehouseActive={b.warehouseActive} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </Card>

      {groups.length > 0 && (
        <Callout tone={ROSE} title="발주를 만든 다음">
          발주만으로는 현재고가 늘지 않습니다. 문서가 <strong>확정</strong>되어야 준비 판단에
          반영되고, <strong>입고 처리</strong>를 해야 현재고에 반영됩니다. 발주
          화면에서 관련 주문의 준비 상태를 확인할 수 있습니다.
        </Callout>
      )}
    </div>
  );
}
