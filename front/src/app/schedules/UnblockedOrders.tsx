"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useOrders } from "@/lib/hooks";
import { shiftDate } from "@/lib/fulfillment";
import { READINESS_TONE } from "@/lib/tone";
import { Badge } from "@/components/ui";
import type { OrderSummary } from "@/lib/types";

/**
 * 이 문서가 들어오면 어느 주문이 풀리는지.
 *
 * <p>주문 목록 응답이 세트 전개 결과와 "무엇을 기다리는지"(`waitingScheduleCodes`)까지
 * 함께 주므로 목록 한 건만 받아서 거른다. 주문마다 상세를 부르면 요청이 주문 수만큼
 * 늘고, 상세 한 건이 서버에서 전역 판정을 한 번씩 더 돌린다.
 */
export function UnblockedOrders({ scheduleCode }: { scheduleCode: string }) {
  const { data: orders, isLoading, error } = useOrders();

  const related = useMemo(() => {
    const waitsForThis = (order: OrderSummary) =>
      order.demands.some((demand) => demand.waitingScheduleCodes.includes(scheduleCode));

    return (orders ?? [])
      .filter(waitsForThis)
      .map((order) => ({
        order,
        // 이 문서만 기다리고 있으면 입고되는 즉시 풀린다. 다른 부족·대기가 함께 있으면 아니다.
        onlyBlocker: !order.demands.some(
          (demand) =>
            demand.shortageQuantity > 0 ||
            demand.waitingScheduleCodes.some((code) => code !== scheduleCode),
        ),
      }));
  }, [orders, scheduleCode]);

  if (error) {
    return (
      <p role="alert" className="text-xs text-bad">
        관련 주문을 불러오지 못했습니다. 다시 확인해 주세요.
      </p>
    );
  }

  if (isLoading || !orders) {
    return <p className="text-xs text-ink-faint">관련 주문을 확인하는 중…</p>;
  }

  if (related.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-raised p-3 text-xs text-ink-faint">
        현재 이 문서를 기다리는 주문이 없습니다. 미확정·기한 초과 등으로 준비에 사용하지 못하거나
        이미 입고된 문서는 대기 대상에 포함되지 않습니다.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-line">
      <p className="border-b border-line bg-raised p-3 text-xs">
        이 문서를 기다리는 주문 {related.length}건 · 입고·검사하면 아래 주문이 다시 판정됩니다
      </p>

      {related.map(({ order, onlyBlocker }) => (
        <Link
          key={order.orderNumber}
          href={`/orders?no=${order.orderNumber}`}
          className="block border-b border-line-soft p-3 last:border-0 hover:bg-accent-soft"
        >
          <div className="flex flex-wrap items-center gap-2">
            <strong className="num text-xs text-accent">{order.orderNumber}</strong>
            {order.readinessStatus && (
              <Badge tone={READINESS_TONE[order.readinessStatus]}>
                {order.readinessStatusLabel}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            배송 {order.deliveryAt.slice(0, 10)} · 입고 필요 {shiftDate(order.deliveryAt, -1)}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            {onlyBlocker
              ? "이 문서의 물량이 입고되면 준비 가능으로 바뀝니다."
              : "이 문서 말고도 부족하거나 기다리는 품목이 있어 함께 확인해야 합니다."}
          </p>
        </Link>
      ))}
    </div>
  );
}
