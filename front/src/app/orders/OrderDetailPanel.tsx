"use client";

import Link from "next/link";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { toDate, toDateTime, deltaColor, signed } from "@/lib/format";
import { useCommand, useOrder } from "@/lib/hooks";
import {
  ORDER_STATUS_TONE,
  READINESS_HINT,
  READINESS_TONE,
  UNIT_STATUS_TONE,
  reasonTone,
} from "@/lib/tone";
import type { OrderDetail } from "@/lib/types";
import { OrderRail } from "@/components/OrderRail";
import {
  Badge,
  Button,
  Hint,
  LedgerList,
  PanelMessage,
  SectionTitle,
} from "@/components/ui";

/**
 * 어디까지 진행됐는지. 서버에 단계 필드가 없어 실제 흔적으로 되짚는다.
 * 비시리얼 주문은 피킹 흔적이 남지 않으므로, 뒤 단계가 끝났으면 앞 단계도 끝난 것으로 본다.
 */
function stepIndexOf(d: OrderDetail): number {
  if (d.order.orderStatus === "SHIPPED" || d.order.orderStatus === "DELIVERED") return 3;
  if (d.pickedUnits.length > 0) return 2;
  if (d.reservations.length > 0) return 1;
  return 0;
}

export function OrderDetailPanel({ orderNumber }: { orderNumber: string | null }) {
  const { data, isLoading, error } = useOrder(orderNumber);
  const { run, pending } = useCommand();

  const derived = useMemo(() => {
    if (!data) return null;
    const reserved = data.reservations.length > 0;
    const shipped =
      data.order.orderStatus === "SHIPPED" || data.order.orderStatus === "DELIVERED";
    // 시리얼 품목이 하나라도 있으면 출고 전에 피킹을 끝내야 한다.
    // 개체 응답에는 품목코드가 없어 품목별로는 맞춰볼 수 없다. 배정 개수 합계로만 판단하고,
    // 실제 품목별 부족은 서버가 출고 시점에 사유와 함께 막아 준다.
    const serialCodes = new Set(
      data.readiness.demands.filter((x) => x.serial).map((x) => x.itemCode),
    );
    const serialQuantity = data.reservations
      .filter((r) => serialCodes.has(r.itemCode))
      .reduce((sum, r) => sum + r.quantity, 0);
    const pickingDone = data.pickedUnits.length >= serialQuantity;

    return {
      reserved,
      shipped,
      needsPicking: serialQuantity > 0,
      pickingDone,
      shortages: data.readiness.demands.filter((d) => d.shortageQuantity > 0),
    };
  }, [data]);

  if (!orderNumber) return <PanelMessage>목록에서 주문을 선택하세요.</PanelMessage>;
  if (error) return <PanelMessage>주문을 불러오지 못했습니다. {String(error.message ?? "")}</PanelMessage>;
  if (isLoading || !data || !derived) return <PanelMessage>불러오는 중…</PanelMessage>;

  const { order, readiness } = data;
  const rTone = READINESS_TONE[readiness.status];
  const [rFg, rBg, rBorder] = reasonTone(readiness.status);
  const stepIndex = stepIndexOf(data);

  const canReserve = readiness.status === "READY" && !derived.reserved && order.preparationTarget;
  const canPick = derived.reserved && !derived.shipped && derived.needsPicking && !derived.pickingDone;
  const canShip =
    derived.reserved && !derived.shipped && (!derived.needsPicking || derived.pickingDone);

  const stepHint = derived.shipped
    ? "출고 완료 — 현재고와 예약수량이 함께 차감되었고 배정된 개체는 출고 완료로 바뀌었습니다."
    : derived.reserved && derived.needsPicking && !derived.pickingDone
      ? "예약만으로는 현재고가 줄지 않습니다. 시리얼 품목은 개체를 배정해야 출고할 수 있습니다."
      : derived.reserved
        ? "예약이 잡혀 있습니다. 출고 시점에 현재고가 차감됩니다."
        : readiness.status === "READY"
          ? "예약할 때 최신 재고를 다시 확인하며, 한 품목이라도 부족하면 전체가 예약되지 않습니다."
          : "현재고만으로 전량 준비되는 주문만 예약할 수 있습니다.";

  return (
    <>
      <div className="border-b border-[#f1f1f5] px-[22px] pt-5 pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="font-mono text-[15px] font-semibold tracking-[-0.01em]">
            {order.orderNumber}
          </h2>
          <Badge tone={rTone}>{readiness.statusLabel}</Badge>
          <Badge tone={ORDER_STATUS_TONE[order.orderStatus]} dot={false}>
            {order.orderStatusLabel}
          </Badge>
        </div>
        <p className="mt-[7px] text-xs leading-[1.7] text-[--color-ink-faint]">
          배송예정 {toDate(order.deliveryAt)} · {order.warehouseName}
          {!order.warehouseActive && (
            <span className="text-[--color-bad]"> (사용 중지)</span>
          )}{" "}
          · 접수 {toDateTime(order.createdAt)}
        </p>
        <OrderRail stepIndex={stepIndex} />
      </div>

      <div className="flex flex-1 flex-col gap-5 px-[22px] pt-[18px] pb-[26px]">
        <div
          className="rounded-[11px] border px-[13px] py-[11px] text-[12.5px] leading-[1.7]"
          style={{ color: rFg, background: rBg, borderColor: rBorder }}
        >
          {READINESS_HINT[readiness.status]}
          {readiness.reviewReasons.length > 0 && (
            <ul className="mt-2 list-disc pl-4">
              {readiness.reviewReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>

        <section>
          <SectionTitle>원 주문 품목</SectionTitle>
          <ul>
            {data.lines.map((l) => {
              const canceled = l.status === "CANCELED";
              return (
                <li key={l.sequence} className="border-b border-[--color-line-soft] py-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-14 flex-none font-mono text-[11px] text-[--color-ink-ghost]">
                      {l.code}
                    </span>
                    <span
                      className="min-w-0 flex-1 text-[12.5px]"
                      style={{
                        color: canceled ? "var(--color-ink-ghost)" : "var(--color-ink)",
                        textDecoration: canceled ? "line-through" : "none",
                      }}
                    >
                      {l.name}
                    </span>
                    <span className="text-[10.5px] text-[--color-ink-ghost]">
                      {canceled ? "취소" : l.kind === "SET" ? "세트" : ""}
                    </span>
                    <span className="w-7 text-right font-mono text-xs">{l.orderQuantity}</span>
                  </div>
                  {l.components.length > 0 && (
                    <ul className="mt-1 mb-1 ml-14 border-l border-[--color-line] pl-2.5">
                      {l.components.map((c) => (
                        <li
                          key={c.itemCode}
                          className="flex items-center gap-2 py-[3px] text-[11.5px]"
                          title={c.excludeReason ?? undefined}
                        >
                          <span className="font-mono text-[10.5px] text-[--color-ink-ghost]">
                            {c.itemCode}
                          </span>
                          <span
                            className="min-w-0 flex-1 truncate"
                            style={{
                              color: c.stockDemand
                                ? "var(--color-ink-muted)"
                                : "var(--color-ink-ghost)",
                            }}
                          >
                            {c.itemName}
                            {!c.stockDemand && " · 준비 제외"}
                          </span>
                          <span className="font-mono">{c.requiredQuantity}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <SectionTitle aside="필요 / 가용">세트 전개 후 준비 품목</SectionTitle>
          {readiness.demands.length === 0 ? (
            <p className="text-xs text-[--color-ink-ghost]">준비할 재고 품목이 없습니다.</p>
          ) : (
            <ul>
              {readiness.demands.map((n) => (
                <li
                  key={n.itemCode}
                  className="border-b border-[--color-line-soft] py-[7px]"
                >
                  <div className="flex items-center gap-2.5">
                    <Link
                      href={`/items?code=${n.itemCode}`}
                      className="w-14 flex-none font-mono text-[11px] text-[--color-accent] hover:underline"
                    >
                      {n.itemCode}
                    </Link>
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">{n.itemName}</span>
                    <span className="font-mono text-xs font-semibold">{n.requiredQuantity}</span>
                    <span className="text-[11px] text-[#d4d4dc]">/</span>
                    <span
                      className="w-6 text-right font-mono text-xs"
                      style={{
                        color:
                          n.availableQuantity >= n.requiredQuantity
                            ? "var(--color-good)"
                            : "var(--color-bad)",
                      }}
                    >
                      {n.availableQuantity}
                    </span>
                  </div>
                  {(n.fromSchedule > 0 || n.shortageQuantity > 0) && (
                    <p className="mt-0.5 ml-14 text-[11px] text-[--color-ink-dim]">
                      현재고 {n.fromStock}
                      {n.fromSchedule > 0 && ` · 입고예정 ${n.fromSchedule}`}
                      {n.shortageQuantity > 0 && (
                        <span className="text-[--color-bad]"> · 부족 {n.shortageQuantity}</span>
                      )}
                      {n.waitingScheduleCodes.length > 0 &&
                        ` · ${n.waitingScheduleCodes.join(", ")}`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {derived.shortages.length > 0 && (
          <section className="rounded-xl border border-[#f4ddd0] bg-[#fef8f4] p-3.5">
            <h3 className="mb-2.5 text-[11.5px] font-semibold text-[--color-bad]">
              부족 품목 — 여기서 바로 발주
            </h3>
            {derived.shortages.map((s) => (
              <div
                key={s.itemCode}
                className="mb-[7px] rounded-[10px] border border-[#f4e4da] bg-white px-[11px] py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                    {s.itemName} · {s.itemCode}
                  </span>
                  <span className="font-mono text-xs text-[--color-bad]">
                    부족 {s.shortageQuantity}
                  </span>
                  <Button
                    variant="primary"
                    disabled={pending || !order.warehouseActive}
                    onClick={() =>
                      run(
                        () =>
                          api.orders.createSchedule(order.orderNumber, {
                            itemCode: s.itemCode,
                            quantity: s.shortageQuantity,
                          }),
                        `${s.itemName} ${s.shortageQuantity} 발주 생성 — 입고 처리 전까지 현재고는 늘지 않습니다.`,
                      )
                    }
                  >
                    {s.itemType === "MANUFACTURED" ? "생산의뢰" : "구매발주"}
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] leading-[1.6] text-[#a79086]">
                  {s.itemTypeLabel} · 입고창고 {order.warehouseName} · 사용 가능 예정일은 공급처
                  리드타임으로 채워집니다.
                </p>
              </div>
            ))}
          </section>
        )}

        {data.schedules.length > 0 && (
          <section>
            <SectionTitle>기다리는 입고 문서</SectionTitle>
            {data.schedules.map((d) => (
              <Link
                key={d.code}
                href={`/schedules?code=${d.code}`}
                className="mb-[7px] flex items-center gap-2.5 rounded-[10px] border border-[--color-line] px-[11px] py-[9px] hover:border-[#c6c7de] hover:bg-[#fcfcfd]"
              >
                <span className="font-mono text-[11.5px] text-[--color-accent]">{d.code}</span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-[--color-ink-faint]">
                  {d.typeLabel}
                  {d.inspectStatus !== "NOT_APPLICABLE" && ` · ${d.inspectStatusLabel}`} · 사용 가능{" "}
                  {toDate(d.availableAt)}
                </span>
                <span className="font-mono text-[11.5px]">
                  {d.receivedQuantity}/{d.planQuantity}
                </span>
              </Link>
            ))}
          </section>
        )}

        {data.reservations.length > 0 && (
          <section>
            <SectionTitle>예약 내역</SectionTitle>
            <ul>
              {data.reservations.map((r) => (
                <li
                  key={`${r.itemCode}-${r.warehouseCode}`}
                  className="flex items-center gap-2.5 border-b border-[--color-line-soft] py-1.5 text-[11.5px]"
                >
                  <span className="font-mono text-[--color-ink-ghost]">{r.itemCode}</span>
                  <span className="min-w-0 flex-1 truncate">{r.itemName}</span>
                  <span className="text-[--color-ink-ghost]">{r.statusLabel}</span>
                  <span className="font-mono font-semibold">{r.quantity}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.pickedUnits.length > 0 && (
          <section>
            <SectionTitle>배정된 시리얼 개체</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {data.pickedUnits.map((u) => (
                <span
                  key={u.serialNumber}
                  className="flex items-center gap-[7px] rounded-lg border border-[--color-line] px-2.5 py-[5px] text-[11.5px]"
                >
                  <span className="font-mono">{u.serialNumber}</span>
                  <span style={{ color: UNIT_STATUS_TONE[u.status][0] }}>{u.statusLabel}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionTitle>수량 변동 이력</SectionTitle>
          <LedgerList
            empty="아직 변동 이력이 없습니다."
            rows={data.ledgers.map((l, i) => ({
              key: `${l.createdAt}-${l.itemCode}-${i}`,
              typeLabel: l.typeLabel,
              delta: signed(l.quantityDelta),
              color: deltaColor(l.quantityDelta),
              memo: l.memo ?? `${l.itemCode} · ${l.warehouseCode}`,
              ref: l.scheduleCode ?? undefined,
            }))}
          />
        </section>
      </div>

      <div className="sticky bottom-0 border-t border-[#f1f1f5] bg-[rgba(255,255,255,.95)] px-[22px] py-3.5 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={!canReserve || pending}
            title={canReserve ? undefined : "현재고만으로 전량 준비되는 주문만 예약합니다."}
            onClick={() =>
              run(
                () => api.orders.reserve(order.orderNumber),
                `${order.orderNumber} 예약 완료 — 현재고는 변하지 않았습니다.`,
              )
            }
          >
            재고 예약
          </Button>
          <Button
            disabled={!canPick || pending}
            title={canPick ? undefined : "예약된 시리얼 품목이 있을 때만 피킹합니다."}
            onClick={() =>
              run(
                () => api.orders.pick(order.orderNumber),
                `${order.orderNumber} 피킹 완료 — 개체가 배정되었습니다.`,
              )
            }
          >
            시리얼 피킹
          </Button>
          <Button
            disabled={!canShip || pending}
            title={canShip ? undefined : "예약과 피킹이 끝난 주문만 출고할 수 있습니다."}
            onClick={() =>
              run(
                () => api.orders.ship(order.orderNumber),
                `${order.orderNumber} 출고 완료 — 현재고가 차감되었습니다.`,
              )
            }
          >
            출고 처리
          </Button>
        </div>
        <Hint>{stepHint}</Hint>
      </div>
    </>
  );
}

