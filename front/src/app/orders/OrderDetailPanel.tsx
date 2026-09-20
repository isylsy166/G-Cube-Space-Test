"use client";

import Link from "next/link";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { toDate, toDateTime, deltaColor, signed } from "@/lib/format";
import { useCommand, useOrder } from "@/lib/hooks";
import {
  ORDER_STATUS_TONE,
  READINESS_ACTION,
  READINESS_HINT,
  READINESS_TONE,
  UNIT_STATUS_TONE,
} from "@/lib/tone";
import type { OrderDetail } from "@/lib/types";
import { ShortageAction } from "@/components/ShortageAction";
import { SerialPicker } from "./SerialPicker";
import { reviewRecipient, shiftDate } from "@/lib/fulfillment";
import { OrderRail } from "@/components/OrderRail";
import {
  Badge,
  Button,
  Callout,
  LedgerList,
  PanelMessage,
  SectionTitle,
} from "@/components/ui";

const DEMAND_COLS = "minmax(0,1fr) 46px 46px 52px 46px";

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

    return {
      reserved,
      shipped,
      needsPicking: serialQuantity > 0,
      pickingDone: data.pickedUnits.length >= serialQuantity,
      shortages: data.readiness.demands.filter((d) => d.shortageQuantity > 0),
      waiting: data.readiness.demands.filter((d) => d.waitingScheduleCodes.length > 0),
    };
  }, [data]);

  if (!orderNumber) return <PanelMessage>목록에서 주문을 선택하세요.</PanelMessage>;
  if (error)
    return (
      <PanelMessage tone="error">
        주문을 불러오지 못했습니다. {String(error.message ?? "")}
      </PanelMessage>
    );
  if (isLoading || !data || !derived) return <PanelMessage>불러오는 중…</PanelMessage>;

  const { order, readiness } = data;
  const tone = READINESS_TONE[readiness.status];
  const stepIndex = stepIndexOf(data);

  const canReserve = readiness.status === "READY" && !derived.reserved && order.preparationTarget;
  const canPick =
    derived.reserved && !derived.shipped && derived.needsPicking && !derived.pickingDone;
  const canShip =
    derived.reserved && !derived.shipped && (!derived.needsPicking || derived.pickingDone);

  const actionTitle = derived.shipped
    ? "출고가 완료된 주문입니다"
    : !order.preparationTarget
      ? "출고 준비 대상이 아닙니다"
      : canPick
        ? "출고할 제품을 배정해 주세요"
        : canShip
          ? "출고 처리를 진행해 주세요"
          : derived.reserved
            ? "재고 예약이 완료되었습니다"
            : READINESS_ACTION[readiness.status];
  const stepHint = derived.shipped
    ? "출고 수량이 재고에 반영되었습니다. 아래 이력에서 처리 내역을 확인하세요."
    : !order.preparationTarget
      ? "취소되었거나 처리가 완료된 주문은 새로 예약할 수 없습니다."
      : canPick
        ? "재고 예약이 완료되었습니다. 아래에서 출고할 제품을 직접 고르거나, 자동 배정으로 시리얼번호가 빠른 제품부터 배정할 수 있습니다."
        : canShip
          ? "출고 준비가 완료되었습니다. 출고 처리하면 재고와 예약 수량에 반영됩니다."
          : derived.reserved
            ? "이 주문에 필요한 재고가 예약되어 있습니다. 배정 내역을 확인하세요."
            : READINESS_HINT[readiness.status];

  return (
    <>
      <div className="border-b border-line px-5 pt-5 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="num text-[17px] font-bold tracking-[-0.01em]">{order.orderNumber}</h2>
          <Badge tone={tone} strong>
            {readiness.statusLabel}
          </Badge>
          <Badge tone={ORDER_STATUS_TONE[order.orderStatus]} dot={false}>
            {order.orderStatusLabel}
          </Badge>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          배송예정 <span className="num font-semibold text-ink-soft">{toDate(order.deliveryAt)}</span>
          {" · "}
          {order.warehouseName}
          {!order.warehouseActive && <span className="text-bad"> (사용 중지)</span>}
          {" · 접수 "}
          <span className="num">{toDateTime(order.createdAt)}</span>
        </p>
        <OrderRail stepIndex={stepIndex} />
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 pt-4 pb-6">
        <Callout tone={tone} title={actionTitle}>
          {stepHint}
          {readiness.reviewReasons.length > 0 && (
            <ul className="mt-2 list-disc pl-4">
              {readiness.reviewReasons.map((r) => (
                <li key={r}>{r}<strong className="mt-1 block">{reviewRecipient(r)}</strong></li>
              ))}
            </ul>
          )}
          {readiness.status === "REVIEW_REQUIRED" && <p className="mt-2 text-xs">재고를 예약하지 않고 확인을 요청하세요. 담당자에게 별도로 전달해야 하며, 이 화면에서 주문 정보를 임의로 바꾸지 않습니다.</p>}
          {derived.waiting.length > 0 && <p className="mt-2 font-semibold">입고 필요 기한: {shiftDate(order.deliveryAt, -1)} (배송 전날)</p>}
          {derived.waiting.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {derived.waiting.map((n) => (
                <li key={n.itemCode} className="text-xs">
                  <strong className="font-semibold">{n.itemName}</strong> {n.fromSchedule}개를{" "}
                  <span className="num">{n.waitingScheduleCodes.join(", ")}</span> 입고에서
                  기다립니다.
                </li>
              ))}
            </ul>
          )}
        </Callout>

        <section>
          <SectionTitle aside="세트상품은 구성품별로 표시합니다">
            준비해야 할 품목
          </SectionTitle>
          {readiness.demands.length === 0 ? (
            <p className="text-xs text-ink-dim">준비할 재고 품목이 없습니다.</p>
          ) : (
            <div className="overflow-hidden rounded-[10px] border border-line">
              <div
                className="grid gap-2 border-b border-line bg-raised px-3 py-2 text-[11px] font-bold text-ink-faint"
                style={{ gridTemplateColumns: DEMAND_COLS }}
              >
                <div>품목</div>
                <div className="text-right">필요</div>
                <div className="text-right" title="출고창고에서 기존 예약과 앞선 주문 배정을 고려한 사용 가능 수량">가용재고</div>
                <div className="text-right" title="입고예정 중 이 주문에 배정할 수 있는 수량">입고 대기</div>
                <div className="text-right">부족</div>
              </div>
              {readiness.demands.map((n) => (
                <div
                  key={n.itemCode}
                  className="grid items-center gap-2 border-b border-line-soft px-3 py-2 last:border-b-0"
                  style={{
                    gridTemplateColumns: DEMAND_COLS,
                    background: n.shortageQuantity > 0 ? "var(--color-row-bad)" : undefined,
                  }}
                >
                  <div className="min-w-0">
                    <Link
                      href={`/items?code=${n.itemCode}`}
                      className="block truncate text-[13px] font-medium hover:text-accent hover:underline"
                    >
                      {n.itemName}
                    </Link>
                    <span className="num block truncate text-[11px] text-ink-dim">
                      {n.itemCode}
                      {n.serial && " · 시리얼"}
                      {n.waitingScheduleCodes.length > 0 &&
                        ` · ${n.waitingScheduleCodes.join(", ")}`}
                    </span>
                    <span className="block text-[10px] text-ink-faint">이 주문 재고 사용 {n.fromStock}개</span>
                  </div>
                  <div className="num text-right text-[13px] font-bold">{n.requiredQuantity}</div>
                  <div className="num text-right text-xs font-semibold text-good">
                    {n.availableQuantity}
                  </div>
                  <div className="num text-right text-xs font-semibold text-warn">
                    {n.fromSchedule || "—"}
                  </div>
                  <div
                    className="num text-right text-xs font-bold"
                    style={{
                      color:
                        n.shortageQuantity > 0 ? "var(--color-bad)" : "var(--color-ink-ghost)",
                    }}
                  >
                    {n.shortageQuantity || "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {derived.shortages.length > 0 && (
          <section>
            <SectionTitle>부족분 발주</SectionTitle>
            <div className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-row-bad p-3">
              {derived.shortages.map((s) => (
                <div key={s.itemCode} className="rounded-[10px] border border-line bg-surface p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                      {s.itemName}
                    </span>
                    <span className="num text-[13px] font-bold text-bad">
                      부족 {s.shortageQuantity}
                    </span>
                  </div>
                  <p className="num mt-0.5 text-[11px] text-ink-dim">
                    {s.itemCode} · {s.itemTypeLabel} · 입고창고 {order.warehouseName}
                  </p>
                  <div className="mt-2.5">
                    <ShortageAction itemCode={s.itemCode} orderNumber={order.orderNumber}
                      deliveryAt={order.deliveryAt} warehouseCode={order.warehouseCode}
                      quantity={s.shortageQuantity} warehouseActive={order.warehouseActive} />
                  </div>
                </div>
              ))}
              <p className="text-[11px] leading-relaxed text-ink-faint">
                사용 가능 예정일은 공급처의 소요 기간을 기준으로 설정됩니다. 발주 화면에서
                문서를 확정하고 입고 진행 상황을 확인하세요.
              </p>
            </div>
          </section>
        )}

        {data.schedules.length > 0 && (
          <section>
            <SectionTitle aside={`필요 기한 ${shiftDate(order.deliveryAt, -1)}`}>관련 입고 문서</SectionTitle>
            <div className="flex flex-col gap-1.5">
              {data.schedules.map((d) => (
                <Link
                  key={d.code}
                  href={`/schedules?code=${d.code}`}
                  className="flex items-center gap-2.5 rounded-[10px] border border-line px-3 py-2.5 transition-colors hover:border-accent hover:bg-accent-soft"
                >
                  <span className="num text-xs font-bold text-accent">{d.code}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-faint">
                    {d.typeLabel} · {d.supplierName} · {d.confirmed ? "확정" : "미확정"}
                    {d.inspectStatus !== "NOT_APPLICABLE" && ` · ${d.inspectStatusLabel}`} · 사용
                    가능 <span className="num">{toDate(d.availableAt)}</span>
                  </span>
                  <span className="num text-xs font-bold">
                    남은 {d.remainingQuantity} / 계획 {d.planQuantity}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <details key={`lines-${orderNumber}`} className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-[13px] font-semibold">원 주문 품목 <span className="ml-1 text-xs font-normal text-ink-faint">{data.lines.length}개 항목</span></summary>
          <p className="my-2 text-[11px] text-ink-faint">세트 구성과 취소 품목을 확인할 수 있습니다. 취소·서비스 품목은 재고 준비에서 제외합니다.</p>
          <ul className="overflow-hidden rounded-[10px] border border-line">
            {data.lines.map((l) => {
              const canceled = l.status === "CANCELED";
              return (
                <li key={l.sequence} className="border-b border-line-soft px-3 py-2 last:border-b-0">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="min-w-0 flex-1 text-[13px]"
                      style={{
                        color: canceled ? "var(--color-ink-ghost)" : "var(--color-ink)",
                        textDecoration: canceled ? "line-through" : "none",
                      }}
                    >
                      {l.name}
                      <span className="num ml-1.5 text-[11px] text-ink-dim">{l.code}</span>
                    </span>
                    {(canceled || l.kind === "SET") && (
                      <span className="rounded border border-line px-1.5 py-[1px] text-[10.5px] font-medium text-ink-faint">
                        {canceled ? "취소" : "세트"}
                      </span>
                    )}
                    <span className="num w-7 text-right text-[13px] font-semibold">
                      {l.orderQuantity}
                    </span>
                  </div>
                  {l.components.length > 0 && (
                    <ul className="mt-1.5 ml-1 border-l-2 border-line pl-3">
                      {l.components.map((c) => (
                        <li
                          key={c.itemCode}
                          className="flex items-center gap-2 py-[3px] text-xs"
                          title={c.excludeReason ?? undefined}
                        >
                          <span
                            className="min-w-0 flex-1 truncate"
                            style={{
                              color: c.stockDemand
                                ? "var(--color-ink-muted)"
                                : "var(--color-ink-ghost)",
                            }}
                          >
                            {c.itemName}
                            <span className="num ml-1.5 text-[10.5px] text-ink-ghost">
                              {c.itemCode}
                            </span>
                            {!c.stockDemand && " · 준비 제외"}
                          </span>
                          <span className="num font-semibold">{c.requiredQuantity}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </details>

        {data.reservations.length > 0 && (
          <section>
            <SectionTitle aside="예약해도 현재고는 줄지 않습니다">예약 내역</SectionTitle>
            <ul className="overflow-hidden rounded-[10px] border border-line">
              {data.reservations.map((r) => (
                <li
                  key={`${r.itemCode}-${r.warehouseCode}`}
                  className="flex items-center gap-2.5 border-b border-line-soft px-3 py-2 text-xs last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px]">{r.itemName}</span>
                  <span className="text-ink-dim">{r.statusLabel}</span>
                  <span className="num text-[13px] font-bold">{r.quantity}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* key 를 주어 다른 주문을 열면 고른 개체가 남지 않게 한다 */}
        {canPick && <SerialPicker key={order.orderNumber} orderNumber={order.orderNumber} />}

        {data.pickedUnits.length > 0 && (
          <section>
            <SectionTitle aside="시리얼번호별 출고 제품">배정된 출고 제품</SectionTitle>
            <ul className="overflow-hidden rounded-[10px] border border-line">
              {data.pickedUnits.map((u) => (
                <li
                  key={u.serialNumber}
                  className="flex items-center gap-2.5 border-b border-line-soft px-3 py-2 last:border-b-0"
                >
                  <span className="num min-w-0 flex-1 truncate text-[13px] font-semibold">
                    {u.serialNumber}
                  </span>
                  <span className="num truncate text-[11px] text-ink-dim">
                    {u.warehouseCode}
                    {u.location ? ` · ${u.location}` : ""}
                  </span>
                  <Badge tone={UNIT_STATUS_TONE[u.status]} dot={false}>
                    {u.statusLabel}
                  </Badge>
                  {/* 출고 전까지는 잘못 고른 제품을 되돌릴 수 있다. 출고된 제품은 되돌리지 않는다. */}
                  {u.status === "RESERVED" && (
                    <Button
                      size="sm"
                      variant="subtle"
                      disabled={pending}
                      title={`${u.serialNumber} 배정을 해제하고 다시 고릅니다.`}
                      onClick={() =>
                        run(
                          () => api.orders.unpick(order.orderNumber, u.serialNumber),
                          `${u.serialNumber} 배정을 해제했습니다.`,
                        )
                      }
                    >
                      해제
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <details key={`history-${orderNumber}`} className="rounded-xl border border-line p-3">
          <summary className="mb-2 cursor-pointer text-[13px] font-semibold">처리 이력 <span className="ml-1 text-xs font-normal text-ink-faint">{data.ledgers.length}건</span></summary>
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
        </details>
      </div>

      <div className="sticky bottom-0 border-t border-line bg-[rgba(255,255,255,.96)] px-5 py-3.5 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={canReserve ? "primary" : "default"}
            disabled={!canReserve || pending}
            title={canReserve ? undefined : "현재고만으로 전량 준비되는 주문만 예약합니다."}
            onClick={() =>
              run(
                () => api.orders.reserve(order.orderNumber),
                `${order.orderNumber} 예약 완료 — 현재고는 변하지 않았습니다.`,
              )
            }
          >
            1 · 재고 예약
          </Button>
          <Button
            variant={canPick ? "primary" : "default"}
            disabled={!canPick || pending}
            title={
              canPick
                ? "시리얼번호가 빠른 제품부터 자동으로 배정합니다. 제품을 직접 고르려면 위 '출고 제품 선택'을 사용하세요."
                : "재고 예약 후 시리얼번호가 있는 제품을 배정할 수 있습니다."
            }
            onClick={() =>
              run(
                () => api.orders.pick(order.orderNumber),
                `${order.orderNumber} 출고 제품을 자동으로 배정했습니다.`,
              )
            }
          >
            2 · 자동 배정
          </Button>
          <Button
            variant={canShip ? "primary" : "default"}
            disabled={!canShip || pending}
            title={canShip ? undefined : "재고 예약과 출고 제품 배정을 먼저 완료해 주세요."}
            onClick={() =>
              run(
                () => api.orders.ship(order.orderNumber),
                `${order.orderNumber} 출고 완료 — 현재고가 차감되었습니다.`,
              )
            }
          >
            3 · 출고 처리
          </Button>
        </div>
        {pending && <p role="status" className="mt-2 text-xs text-ink-faint">처리 중입니다. 잠시만 기다려 주세요.</p>}
      </div>
    </>
  );
}
