"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useOrderDetails, useOrders } from "@/lib/hooks";
import { ddayLabel } from "@/lib/basetime";
import { READINESS_TONE } from "@/lib/tone";
import { Badge } from "@/components/ui";

/**
 * "이 발주가 들어오면 어느 주문이 풀리는가."
 * 준비 판정에서 각 주문이 어떤 입고 문서를 기다리는지 내려주므로, 그 목록을 거꾸로 훑는다.
 * 아직 기다릴 것이 있는 주문만 상세를 받아 불필요한 호출을 줄인다.
 */
export function UnblockedOrders({ scheduleCode }: { scheduleCode: string }) {
  const { data: orders } = useOrders();

  const candidates = useMemo(
    () =>
      (orders ?? [])
        .filter(
          (o) =>
            o.preparationTarget &&
            (o.readinessStatus?.startsWith("WAIT_") || o.readinessStatus === "SHORTAGE"),
        )
        .map((o) => o.orderNumber),
    [orders],
  );

  const { data, isLoading } = useOrderDetails(candidates);

  const waiting = useMemo(
    () =>
      (data ?? [])
        .map((d) => {
          const demands = d.readiness.demands.filter((n) =>
            n.waitingScheduleCodes.includes(scheduleCode),
          );
          return demands.length > 0 ? { detail: d, demands } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [data, scheduleCode],
  );

  if (isLoading)
    return <p className="text-xs text-[--color-ink-ghost]">확인하는 중…</p>;

  if (waiting.length === 0)
    return (
      <p className="text-xs text-[--color-ink-ghost]">
        이 문서를 기다리는 주문이 없습니다. 입고하면 그만큼 가용재고로만 남습니다.
      </p>
    );

  return (
    <ul>
      {waiting.map(({ detail, demands }) => (
        <li key={detail.order.orderNumber} className="border-b border-[--color-line-soft]">
          <Link
            href={`/orders?no=${detail.order.orderNumber}`}
            className="flex items-center gap-2.5 py-2 hover:bg-[#fafafc]"
          >
            <span className="w-[124px] flex-none font-mono text-[11.5px] text-[--color-accent]">
              {detail.order.orderNumber}
            </span>
            <span className="w-[54px] flex-none font-mono text-[11px] text-[--color-ink-ghost]">
              {ddayLabel(detail.order.deliveryAt)}
            </span>
            <Badge tone={READINESS_TONE[detail.readiness.status]} dot={false}>
              {detail.readiness.statusLabel}
            </Badge>
            <span className="ml-auto font-mono text-[11.5px]">
              {demands.reduce((sum, n) => sum + n.requiredQuantity, 0)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
