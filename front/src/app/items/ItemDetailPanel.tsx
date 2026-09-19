"use client";

import Link from "next/link";
import { deltaColor, signed, toDate } from "@/lib/format";
import { useItem } from "@/lib/hooks";
import { READINESS_TONE, UNIT_STATUS_TONE } from "@/lib/tone";
import { Badge, LedgerList, PanelMessage, SectionTitle, StatGrid } from "@/components/ui";

export function ItemDetailPanel({ code }: { code: string | null }) {
  const { data, isLoading, error } = useItem(code);

  if (!code) return <PanelMessage>목록에서 품목을 선택하세요.</PanelMessage>;
  if (error) return <PanelMessage>품목을 불러오지 못했습니다.</PanelMessage>;
  if (isLoading || !data) return <PanelMessage>불러오는 중…</PanelMessage>;

  const { item } = data;
  const stockless = item.type === "SERVICE";
  // 창고별 합계는 사용 중인 창고 기준이다. 중지 창고 수량은 따로 떼어 보여 준다.

  return (
    <div className="px-[22px] pt-5 pb-[34px]">
      <p className="font-mono text-[11.5px] text-[--color-accent]">{item.code}</p>
      <h2 className="mt-[3px] text-[17px] font-bold tracking-[-0.01em]">{item.name}</h2>
      <p className="mt-1.5 text-xs leading-[1.7] text-[--color-ink-faint]">
        {item.category} · {item.typeLabel} · 시리얼 {item.serial ? "관리" : "미관리"} · 기본
        공급처 {item.supplierName}
        {item.spec && ` · ${item.spec}`}
      </p>

      <StatGrid
        stats={[
          { label: "현재고", value: stockless ? "—" : item.quantity },
          {
            label: "예약",
            value: stockless ? "—" : item.bookedQuantity,
            color: "var(--color-ink-faint)",
          },
          {
            label: "가용",
            value: stockless ? "—" : item.availableQuantity,
            color: stockless
              ? "#C8C8D2"
              : item.availableQuantity > 0
                ? "var(--color-good)"
                : "var(--color-bad)",
          },
        ]}
      />

      {item.inactiveWarehouseQuantity > 0 && (
        <p className="mt-2.5 rounded-[10px] border border-[#f4ddd0] bg-[#fef8f4] px-3 py-2 text-[11.5px] leading-[1.6] text-[--color-bad]">
          사용 중지된 창고에 {item.inactiveWarehouseQuantity}개가 남아 있습니다. 이 수량은 준비
          판단에 쓰이지 않습니다.
        </p>
      )}

      <section className="mt-[22px]">
        <SectionTitle>창고별 재고</SectionTitle>
        {data.stocks.length === 0 ? (
          <p className="text-xs text-[--color-ink-ghost]">재고 기록이 없습니다.</p>
        ) : (
          <>
            <ul>
              {data.stocks.map((s) => (
                <li
                  key={s.warehouseCode}
                  className="grid grid-cols-[minmax(0,1fr)_42px_42px_42px] items-center gap-2 border-b border-[--color-line-soft] py-2"
                >
                  <span
                    className="truncate text-[12.5px]"
                    style={{ color: s.active ? "var(--color-ink-soft)" : "var(--color-bad)" }}
                  >
                    {s.warehouseName} · {s.warehouseCode}
                    {!s.active && " · 사용 중지"}
                  </span>
                  <span className="text-right font-mono text-xs">{s.quantity}</span>
                  <span className="text-right font-mono text-xs text-[--color-ink-dim]">
                    {s.bookedQuantity}
                  </span>
                  <span
                    className="text-right font-mono text-xs font-semibold"
                    style={{
                      color: !s.active
                        ? "#C8C8D2"
                        : s.availableQuantity > 0
                          ? "var(--color-good)"
                          : "var(--color-bad)",
                    }}
                  >
                    {s.availableQuantity}
                  </span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-[minmax(0,1fr)_42px_42px_42px] gap-2 pt-[5px] text-[10px] text-[#c0c0cc]">
              <span />
              <span className="text-right">현재고</span>
              <span className="text-right">예약</span>
              <span className="text-right">가용</span>
            </div>
          </>
        )}
      </section>

      {item.serial && (
        <section className="mt-[22px]">
          <SectionTitle aside="상태 / 배정 주문">개체 재고 · 보관 위치</SectionTitle>
          {data.units.length === 0 ? (
            <p className="text-xs text-[--color-ink-ghost]">등록된 개체가 없습니다.</p>
          ) : (
            <ul>
              {data.units.map((u) => (
                <li
                  key={u.serialNumber}
                  className="flex items-center gap-2.5 border-b border-[--color-line-soft] py-2 text-xs"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono">{u.serialNumber}</span>
                    <span className="block truncate text-[10.5px] text-[--color-ink-ghost]">
                      {u.warehouseCode}
                      {u.location ? ` · ${u.location}` : " · 위치 미지정"}
                    </span>
                  </span>
                  <Badge tone={UNIT_STATUS_TONE[u.status]}>{u.statusLabel}</Badge>
                  <span className="w-[112px] text-right font-mono text-[11px]">
                    {u.assignedOrderNumber ? (
                      <Link
                        href={`/orders?no=${u.assignedOrderNumber}`}
                        className="text-[--color-accent] hover:underline"
                      >
                        {u.assignedOrderNumber}
                      </Link>
                    ) : (
                      <span className="text-[--color-ink-ghost]">미배정</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-[22px]">
        <SectionTitle>이 품목을 기다리는 주문</SectionTitle>
        {data.waitingOrders.length === 0 ? (
          <p className="text-xs text-[--color-ink-ghost]">대기 중인 주문이 없습니다.</p>
        ) : (
          <ul>
            {data.waitingOrders.map((o) => (
              <li key={o.orderNumber} className="border-b border-[--color-line-soft]">
                <Link
                  href={`/orders?no=${o.orderNumber}`}
                  className="flex items-center gap-2.5 py-[7px] hover:bg-[#fafafc]"
                >
                  <span className="w-[106px] flex-none font-mono text-[11.5px] text-[--color-accent]">
                    {o.orderNumber}
                  </span>
                  <span className="w-[70px] flex-none font-mono text-[11px] text-[--color-ink-ghost]">
                    {toDate(o.deliveryAt)}
                  </span>
                  <Badge tone={READINESS_TONE[o.readinessStatus]} dot={false}>
                    {o.readinessStatusLabel}
                  </Badge>
                  <span className="ml-auto font-mono text-[11.5px]">
                    {o.requiredQuantity}
                    {o.shortageQuantity > 0 && (
                      <span className="text-[--color-bad]"> (부족 {o.shortageQuantity})</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-[22px]">
        <SectionTitle>발주 · 생산 문서</SectionTitle>
        {data.schedules.length === 0 ? (
          <p className="text-xs text-[--color-ink-ghost]">진행 중인 문서가 없습니다.</p>
        ) : (
          <ul>
            {data.schedules.map((d) => (
              <li key={d.code} className="border-b border-[--color-line-soft]">
                <Link
                  href={`/schedules?code=${d.code}`}
                  className="flex items-center gap-2.5 py-[7px] hover:bg-[#fafafc]"
                >
                  <span className="w-[106px] flex-none font-mono text-[11.5px] text-[--color-accent]">
                    {d.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-[--color-ink-faint]">
                    {d.typeLabel} · {d.warehouseName} · {d.statusLabel ?? "—"}
                    {!d.confirmed && " · 미확정"}
                  </span>
                  <span className="font-mono text-[11.5px]">
                    {d.receivedQuantity}/{d.planQuantity}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-[22px]">
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

