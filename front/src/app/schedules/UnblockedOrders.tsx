"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useOrderDetails, useOrders } from "@/lib/hooks";
import { shiftDate } from "@/lib/fulfillment";
import { READINESS_TONE } from "@/lib/tone";
import { Badge } from "@/components/ui";

/** 현재 화면에서 확인한 관련 주문을 유지해 입고 후 상태도 확인한다. */
export function UnblockedOrders({ scheduleCode }: { scheduleCode: string }) {
  const { data: orders, error: ordersError } = useOrders();
  const [observed, setObserved] = useState<string[]>([]);
  const candidates = useMemo(() => (orders ?? []).filter((order) => order.preparationTarget || observed.includes(order.orderNumber)).map((order) => order.orderNumber), [orders, observed]);
  const { data, isLoading, error } = useOrderDetails(candidates);
  const linked = useMemo(() => (data ?? []).filter((detail) => detail.readiness.demands.some((demand) => demand.waitingScheduleCodes.includes(scheduleCode))).map((detail) => detail.order.orderNumber), [data, scheduleCode]);
  if (linked.some((no) => !observed.includes(no))) {
    setObserved([...new Set([...observed, ...linked])]);
  }
  const related = (data ?? []).filter((detail) => linked.includes(detail.order.orderNumber) || observed.includes(detail.order.orderNumber));
  if (error || ordersError) return <p role="alert" className="text-xs text-bad">관련 주문을 불러오지 못했습니다. 다시 확인해 주세요.</p>;
  if (!orders || isLoading) return <p className="text-xs text-ink-faint">관련 주문을 확인하는 중…</p>;
  if (!related.length) return <p className="rounded-lg border border-line bg-raised p-3 text-xs text-ink-faint">현재 이 문서를 기다리는 주문이 없습니다. 미확정·기한 초과 등으로 준비에 사용하지 못하거나 이미 입고된 문서는 대기 대상에 포함되지 않습니다.</p>;
  return <div className="rounded-xl border border-line">
    <p className="border-b border-line bg-raised p-3 text-xs">이 화면에서 확인한 관련 주문 {related.length}건 · 입고·검사 후 현재 상태</p>
    {related.map((detail) => {
      const waiting = linked.includes(detail.order.orderNumber);
      const onlyBlocker = waiting && !detail.readiness.demands.some((demand) => demand.shortageQuantity > 0 || demand.waitingScheduleCodes.some((code) => code !== scheduleCode));
      return <Link key={detail.order.orderNumber} href={`/orders?no=${detail.order.orderNumber}`} className="block border-b border-line-soft p-3 last:border-0 hover:bg-accent-soft">
        <div className="flex flex-wrap items-center gap-2"><strong className="num text-xs text-accent">{detail.order.orderNumber}</strong><Badge tone={READINESS_TONE[detail.readiness.status]}>{detail.readiness.statusLabel}</Badge></div>
        <p className="mt-1 text-xs text-ink-faint">배송 {detail.order.deliveryAt.slice(0, 10)} · 입고 필요 {shiftDate(detail.order.deliveryAt, -1)}</p>
        <p className="mt-1 text-xs text-ink-soft">{detail.readiness.status === "READY" ? "준비 가능합니다. 주문으로 이동해 예약을 진행하세요." : onlyBlocker ? "이 문서의 필요한 수량이 입고되면 준비 가능할 것으로 예상됩니다." : waiting ? "다른 부족·대기 품목도 함께 확인해야 합니다." : "더 이상 이 문서를 기다리지 않습니다. 현재 주문 상태와 부족 사유를 확인하세요."}</p>
      </Link>;
    })}
  </div>;
}
