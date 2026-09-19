"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { deltaColor, pct, signed, toDate } from "@/lib/format";
import { useCommand, useSchedule } from "@/lib/hooks";
import { INSPECT_TONE, SCHEDULE_TYPE_TONE } from "@/lib/tone";
import { UnblockedOrders } from "./UnblockedOrders";
import {
  Badge,
  Button,
  Hint,
  LedgerList,
  PanelMessage,
  ProgressBar,
  SectionTitle,
  StatGrid,
} from "@/components/ui";

export function ScheduleDetailPanel({ code }: { code: string | null }) {
  const { data, isLoading, error } = useSchedule(code);
  const { run, pending } = useCommand();
  const [quantity, setQuantity] = useState<number | null>(null);

  const remaining = data?.schedule.remainingQuantity ?? 0;

  if (!code) return <PanelMessage>목록에서 문서를 선택하세요.</PanelMessage>;
  if (error) return <PanelMessage>문서를 불러오지 못했습니다.</PanelMessage>;
  if (isLoading || !data) return <PanelMessage>불러오는 중…</PanelMessage>;

  const { schedule: s } = data;
  const isProduction = s.type === "PRODUCTION";
  const inspected = s.inspectStatus === "INSPECTED";
  const rejected = s.inspectStatus === "REJECTED";

  const qty = Math.min(Math.max(quantity ?? remaining, 0), remaining);
  const percent = pct(s.receivedQuantity, s.planQuantity);

  // 생산의뢰는 검사를 통과해야 입고할 수 있다.
  const canReceive = s.confirmed && remaining > 0 && qty > 0 && (!isProduction || inspected);

  const hint = !s.confirmed
    ? "미확정 문서는 준비 판단에 쓰이지 않고 입고도 할 수 없습니다. 먼저 발주를 확정하세요."
    : remaining <= 0
      ? "남은 수량이 없습니다. 같은 요청을 반복해도 현재고는 변하지 않습니다."
      : isProduction && !inspected
        ? "생산의뢰는 품질검사를 통과한 뒤에야 입고할 수 있습니다. 불합격 물량은 현재고가 되지 않습니다."
        : "입고하면 현재고가 늘고, 이 문서를 기다리던 주문이 곧바로 재판정됩니다. 계획수량 초과 입고는 거부됩니다.";

  return (
    <div className="px-[22px] pt-5 pb-[34px]">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="font-mono text-[15px] font-semibold">{s.code}</h2>
        <Badge tone={SCHEDULE_TYPE_TONE[s.type]} dot={false}>
          {s.typeLabel}
        </Badge>
        <Badge tone={s.confirmed ? ["#4C4F8A", "#EDEEF6"] : ["#C2410C", "#FCEEE7"]}>
          {s.confirmed ? "확정" : "미확정"}
        </Badge>
        {s.inspectStatus !== "NOT_APPLICABLE" && (
          <Badge tone={INSPECT_TONE[s.inspectStatus]}>{s.inspectStatusLabel}</Badge>
        )}
      </div>

      <p className="mt-[7px] text-xs leading-[1.7] text-[--color-ink-faint]">
        {s.itemName} · {s.itemCode} · 입고창고 {s.warehouseName}
        {!s.warehouseActive && <span className="text-[--color-bad]"> (사용 중지)</span>} · 공급처{" "}
        {s.supplierName} · 리드타임 {s.leadTimeDays}일 · 사용 가능 예정 {toDate(s.availableAt)}
      </p>

      <StatGrid
        stats={[
          { label: "계획수량", value: s.planQuantity },
          { label: "입고수량", value: s.receivedQuantity, color: "var(--color-good)" },
          {
            label: "남은수량",
            value: remaining,
            color: remaining > 0 ? "var(--color-bad)" : "var(--color-ink-faint)",
          },
        ]}
      />

      <div className="mt-3.5">
        <ProgressBar percent={percent} height={7} />
      </div>

      <section className="mt-[22px]">
        <SectionTitle>입고 처리</SectionTitle>

        {isProduction && (
          <div className="mb-[11px] flex flex-wrap items-center gap-[7px]">
            <span className="w-[52px] text-[11.5px] text-[--color-ink-faint]">품질검사</span>
            {(
              [
                { label: "통과", passed: true, on: inspected },
                { label: "불합격", passed: false, on: rejected },
              ] as const
            ).map((b) => (
              <button
                key={b.label}
                type="button"
                disabled={pending || remaining <= 0}
                onClick={() =>
                  run(
                    () => api.schedules.inspect(s.code, b.passed),
                    b.passed
                      ? `${s.code} 검사 통과 — 이제 입고할 수 있습니다.`
                      : `${s.code} 검사 불합격 — 통과 전까지 입고할 수 없습니다.`,
                  )
                }
                className="rounded-full border px-3 py-[5px] text-[11.5px] enabled:cursor-pointer disabled:opacity-50"
                style={{
                  borderColor: b.on ? "var(--color-accent)" : "#E8E8EE",
                  background: b.on ? "var(--color-accent)" : "#FFFFFF",
                  color: b.on ? "#FFFFFF" : "var(--color-ink-faint)",
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-[10px] border border-[#e8e8ee]">
            <button
              type="button"
              aria-label="입고수량 감소"
              disabled={qty <= 0}
              onClick={() => setQuantity(qty - 1)}
              className="grid h-[34px] w-8 place-items-center text-[15px] text-[#7c7c8c] enabled:cursor-pointer enabled:hover:bg-[--color-canvas] disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-12 text-center font-mono text-sm font-semibold">{qty}</span>
            <button
              type="button"
              aria-label="입고수량 증가"
              disabled={qty >= remaining}
              onClick={() => setQuantity(qty + 1)}
              className="grid h-[34px] w-8 place-items-center text-[15px] text-[#7c7c8c] enabled:cursor-pointer enabled:hover:bg-[--color-canvas] disabled:opacity-40"
            >
              +
            </button>
          </div>

          <Button
            variant="primary"
            disabled={!canReceive || pending}
            onClick={() =>
              run(
                () => api.schedules.receive(s.code, qty),
                `${s.code} ${qty} 입고 — 현재고가 늘고 대기 주문이 재판정됩니다.`,
              )
            }
          >
            {remaining > 0 ? "입고 처리" : "입고 완료"}
          </Button>

          {!s.confirmed && (
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => api.schedules.confirm(s.code),
                  `${s.code} 확정 — 준비 판단에 반영됩니다.`,
                )
              }
            >
              발주 확정
            </Button>
          )}
        </div>

        <Hint>{hint}</Hint>
      </section>

      <section className="mt-[22px]">
        <SectionTitle>이 문서가 들어오면 풀리는 주문</SectionTitle>
        <UnblockedOrders scheduleCode={s.code} />
      </section>

      <section className="mt-[22px]">
        <SectionTitle>이 문서를 만들게 한 주문</SectionTitle>
        {data.sourceOrderNumber ? (
          <Link
            href={`/orders?no=${data.sourceOrderNumber}`}
            className="flex items-center gap-2.5 border-b border-[--color-line-soft] py-[7px] hover:bg-[#fafafc]"
          >
            <span className="font-mono text-[11.5px] text-[--color-accent]">
              {data.sourceOrderNumber}
            </span>
            <span className="text-[11.5px] text-[--color-ink-faint]">
              이 주문의 부족분으로 만들어진 문서입니다.
            </span>
          </Link>
        ) : (
          <p className="text-xs text-[--color-ink-ghost]">
            연결된 주문이 없습니다. 재고 보충 목적의 문서입니다.
          </p>
        )}
      </section>

      <section className="mt-[22px]">
        <SectionTitle>처리 이력</SectionTitle>
        <LedgerList
          empty="아직 처리 이력이 없습니다."
          rows={data.ledgers.map((l, i) => ({
            key: `${l.createdAt}-${i}`,
            typeLabel: l.typeLabel,
            delta: signed(l.quantityDelta),
            color: deltaColor(l.quantityDelta),
            memo: l.memo ?? `${l.itemCode} · ${l.warehouseCode}`,
          }))}
        />
      </section>
    </div>
  );
}

