"use client";

import Link from "next/link";
import { deltaColor, signed, toDate } from "@/lib/format";
import { useItem } from "@/lib/hooks";
import { ORANGE, READINESS_TONE, UNIT_STATUS_TONE } from "@/lib/tone";
import {
  AvailableFormula,
  Badge,
  Callout,
  LedgerList,
  PanelMessage,
  SectionTitle,
} from "@/components/ui";

const STOCK_COLS = "minmax(0,1fr) 48px 48px 52px";

export function ItemDetailPanel({ code }: { code: string | null }) {
  const { data, isLoading, error } = useItem(code);

  if (!code) return <PanelMessage>목록에서 품목을 선택하세요.</PanelMessage>;
  if (error) return <PanelMessage tone="error">품목을 불러오지 못했습니다.</PanelMessage>;
  if (isLoading || !data) return <PanelMessage>불러오는 중…</PanelMessage>;

  const { item } = data;
  const stockless = item.type === "SERVICE";

  return (
    <div className="px-5 pt-5 pb-9">
      <p className="num text-xs font-bold text-accent">{item.code}</p>
      <h2 className="mt-1 text-[19px] leading-tight font-bold tracking-[-0.01em]">{item.name}</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
        {item.category} · {item.typeLabel} · 시리얼 {item.serial ? "관리" : "미관리"} · 기본 공급처{" "}
        {item.supplierName}
        {item.spec && ` · ${item.spec}`}
      </p>

      {stockless ? (
        <Callout tone={ORANGE}>
          서비스 품목은 재고를 차지하지 않습니다. 주문에 들어 있어도 준비 수량을 만들지 않습니다.
        </Callout>
      ) : (
        <AvailableFormula
          className="mt-4"
          quantity={item.quantity}
          booked={item.bookedQuantity}
          available={item.availableQuantity}
        />
      )}

      {item.inactiveWarehouseQuantity > 0 && (
        <div className="mt-2.5">
          <Callout tone={ORANGE}>
            사용 중지된 창고에 <strong>{item.inactiveWarehouseQuantity}개</strong>가 남아 있습니다.
            이 수량은 위 계산과 준비 판단에 쓰이지 않습니다.
          </Callout>
        </div>
      )}

      <section className="mt-6">
        <SectionTitle aside="주문은 지정된 출고창고 재고만 씁니다">창고별 재고</SectionTitle>
        {data.stocks.length === 0 ? (
          <p className="text-xs text-ink-dim">재고 기록이 없습니다.</p>
        ) : (
          <div className="overflow-hidden rounded-[10px] border border-line">
            <div
              className="grid gap-2 border-b border-line bg-raised px-3 py-2 text-[11px] font-bold text-ink-faint"
              style={{ gridTemplateColumns: STOCK_COLS }}
            >
              <div>창고</div>
              <div className="text-right">현재고</div>
              <div className="text-right">− 예약</div>
              <div className="text-right text-good">= 가용</div>
            </div>
            {data.stocks.map((s) => (
              <div
                key={s.warehouseCode}
                className="grid items-center gap-2 border-b border-line-soft px-3 py-2 last:border-b-0"
                style={{
                  gridTemplateColumns: STOCK_COLS,
                  background: s.active ? undefined : "var(--color-row-bad)",
                }}
              >
                <span className="min-w-0">
                  <span
                    className="block truncate text-[13px]"
                    style={{ color: s.active ? "var(--color-ink)" : "var(--color-bad)" }}
                  >
                    {s.warehouseName}
                  </span>
                  <span className="num block truncate text-[11px] text-ink-dim">
                    {s.warehouseCode}
                    {!s.active && " · 사용 중지"}
                  </span>
                </span>
                <span className="num text-right text-[13px]">{s.quantity}</span>
                <span className="num text-right text-[13px] text-ink-dim">{s.bookedQuantity}</span>
                <span
                  className="num text-right text-[15px] font-bold"
                  style={{
                    color: !s.active
                      ? "#C2C7D2"
                      : s.availableQuantity > 0
                        ? "var(--color-good)"
                        : "var(--color-bad)",
                  }}
                >
                  {s.availableQuantity}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {item.serial && (
        <section className="mt-6">
          <SectionTitle aside="시리얼번호별 연결 주문">시리얼번호별 제품</SectionTitle>
          {data.units.length === 0 ? (
            <p className="text-xs text-ink-dim">등록된 시리얼 제품이 없습니다.</p>
          ) : (
            <ul className="overflow-hidden rounded-[10px] border border-line">
              {data.units.map((u) => (
                <li
                  key={u.serialNumber}
                  className="flex items-center gap-2.5 border-b border-line-soft px-3 py-2 last:border-b-0"
                  style={{ background: u.assignedOrderNumber ? "var(--color-accent-soft)" : undefined }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="num block truncate text-[13px] font-semibold">
                      {u.serialNumber}
                    </span>
                    <span className="num block truncate text-[11px] text-ink-dim">
                      {u.warehouseCode}
                      {u.location ? ` · ${u.location}` : " · 위치 미지정"}
                    </span>
                  </span>
                  <Badge tone={UNIT_STATUS_TONE[u.status]} dot={false}>
                    {u.statusLabel}
                  </Badge>
                  <span className="num w-[116px] shrink-0 text-right text-xs">
                    {u.assignedOrderNumber ? (
                      <Link
                        href={`/orders?no=${u.assignedOrderNumber}`}
                        className="font-semibold text-accent hover:underline"
                      >
                        {u.assignedOrderNumber}
                      </Link>
                    ) : (
                      <span className="text-ink-ghost">미배정</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-6">
        <SectionTitle aside="필요 / 부족">이 품목을 기다리는 주문</SectionTitle>
        {data.waitingOrders.length === 0 ? (
          <p className="text-xs text-ink-dim">대기 중인 주문이 없습니다.</p>
        ) : (
          <ul className="overflow-hidden rounded-[10px] border border-line">
            {data.waitingOrders.map((o) => (
              <li key={o.orderNumber} className="border-b border-line-soft last:border-b-0">
                <Link
                  href={`/orders?no=${o.orderNumber}`}
                  className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-accent-soft"
                >
                  <span className="num w-[108px] flex-none text-xs font-semibold text-accent">
                    {o.orderNumber}
                  </span>
                  <span className="num w-[72px] flex-none text-[11px] text-ink-dim">
                    {toDate(o.deliveryAt)}
                  </span>
                  <Badge tone={READINESS_TONE[o.readinessStatus]} dot={false}>
                    {o.readinessStatusLabel}
                  </Badge>
                  <span className="num ml-auto text-xs font-semibold">
                    {o.requiredQuantity}
                    {o.shortageQuantity > 0 && (
                      <span className="font-bold text-bad"> · 부족 {o.shortageQuantity}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <SectionTitle aside="입고 / 계획">발주 · 생산 문서</SectionTitle>
        {data.schedules.length === 0 ? (
          <p className="text-xs text-ink-dim">진행 중인 문서가 없습니다.</p>
        ) : (
          <ul className="overflow-hidden rounded-[10px] border border-line">
            {data.schedules.map((d) => (
              <li key={d.code} className="border-b border-line-soft last:border-b-0">
                <Link
                  href={`/schedules?code=${d.code}`}
                  className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-accent-soft"
                >
                  <span className="num w-[108px] flex-none text-xs font-semibold text-accent">
                    {d.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-faint">
                    {d.typeLabel} · {d.warehouseName} · {d.statusLabel ?? "—"}
                    {!d.confirmed && <span className="font-semibold text-bad"> · 미확정</span>}
                  </span>
                  <span className="num text-xs font-semibold">
                    {d.receivedQuantity}/{d.planQuantity}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <SectionTitle>수량 변동 이력</SectionTitle>
        <LedgerList
          empty="변동 이력이 없습니다."
          rows={data.ledgers.map((l, i) => ({
            key: `${l.createdAt}-${i}`,
            typeLabel: l.typeLabel,
            delta: signed(l.quantityDelta),
            color: deltaColor(l.quantityDelta),
            memo: l.memo ?? l.warehouseCode,
            ref: l.scheduleCode ?? l.orderNumber ?? undefined,
          }))}
        />
      </section>
    </div>
  );
}
