"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { deltaColor, pct, signed, toDate, toDateTime } from "@/lib/format";
import { useCommand, useSchedule } from "@/lib/hooks";
import { AMBER, GREEN, INSPECT_TONE, ORANGE, SCHEDULE_TYPE_TONE, SLATE } from "@/lib/tone";
import { UnblockedOrders } from "./UnblockedOrders";
import {
  Badge,
  Button,
  Callout,
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

  if (!code) return <PanelMessage>목록에서 문서를 선택하세요.</PanelMessage>;
  if (error) return <PanelMessage tone="error">문서를 불러오지 못했습니다.</PanelMessage>;
  if (isLoading || !data) return <PanelMessage>불러오는 중…</PanelMessage>;

  const { schedule: s } = data;
  const remaining = s.remainingQuantity;
  const isProduction = s.type === "PRODUCTION";
  const inspected = s.inspectStatus === "INSPECTED";
  const rejected = s.inspectStatus === "REJECTED";

  const qty = Math.min(Math.max(quantity ?? remaining, 0), remaining);
  const percent = pct(s.receivedQuantity, s.planQuantity);

  // 생산의뢰는 검사를 통과해야 입고할 수 있다.
  const canReceive = s.warehouseActive && s.confirmed && remaining > 0 && qty > 0 && (!isProduction || inspected);

  const hint = !s.confirmed
    ? "미확정 문서는 준비 판단에 쓰이지 않고 입고도 할 수 없습니다. 먼저 발주를 확정하세요."
    : remaining <= 0
      ? "남은 수량이 없습니다. 같은 요청을 반복해도 현재고는 변하지 않습니다."
      : isProduction && !inspected
        ? "생산의뢰는 품질검사를 통과한 뒤에야 입고할 수 있습니다. 불합격 물량은 현재고가 되지 않습니다."
        : "입고하면 현재고가 늘고, 이 문서를 기다리던 주문이 곧바로 준비 상태가 갱신됩니다. 계획 수량 이내로 입고해 주세요.";

  // 왜 판정에 반영되지 않는지 화면에서 바로 짚어 준다.
  const blockReason = !s.confirmed
    ? "미확정 문서라 준비 판단에 쓰이지 않습니다."
    : !s.warehouseActive
      ? "사용 중지된 창고로 들어오는 문서라 준비 판단에 쓰이지 않습니다."
      : rejected
        ? "품질검사에서 불합격해 준비 판단에 쓰이지 않습니다."
        : remaining <= 0
          ? "받을 수량이 남아 있지 않습니다."
          : "사용 가능 예정일이 없어 준비 판단에 쓰이지 않습니다.";

  return (
    <div className="px-5 pt-5 pb-9">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="num text-[17px] font-bold tracking-[-0.01em]">{s.code}</h2>
        <Badge tone={SCHEDULE_TYPE_TONE[s.type]} dot={false}>
          {s.typeLabel}
        </Badge>
        <Badge tone={s.confirmed ? GREEN : ORANGE}>{s.confirmed ? "확정" : "미확정"}</Badge>
        {s.inspectStatus !== "NOT_APPLICABLE" && (
          <Badge tone={INSPECT_TONE[s.inspectStatus]}>{s.inspectStatusLabel}</Badge>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink-faint">
        <Link href={`/items?code=${s.itemCode}`} className="font-semibold text-accent underline">{s.itemName}</Link>{" "}
        <span className="num">{s.itemCode}</span> · 입고창고 {s.warehouseName}
        {!s.warehouseActive && <span className="font-semibold text-bad"> (사용 중지)</span>} · 공급처{" "}
        {s.supplierName} · 공급 소요 기간 <span className="num">{s.leadTimeDays}</span>일
      </p>

      <StatGrid
        stats={[
          { label: "계획수량", value: s.planQuantity },
          { label: "입고수량", value: s.receivedQuantity, color: "var(--color-good)" },
          {
            label: "남은수량",
            value: remaining,
            color: remaining > 0 ? "var(--color-warn)" : "var(--color-ink-dim)",
          },
        ]}
      />

      <div className="mt-3">
        <ProgressBar percent={percent} height={8} />
        <div className="mt-1.5 flex items-baseline justify-between text-[11px] text-ink-dim">
          <span className="num font-semibold text-ink-faint">{percent}% 입고</span>
          <span>
            사용 가능 예정 <span className="num font-semibold">{toDate(s.availableAt)}</span>
          </span>
        </div>
      </div>

      <div className="mt-3.5">
        {s.usableForPlanning ? (
          <Callout tone={GREEN} title="주문 준비에 사용할 입고예정">
            남은 <strong>{remaining}</strong>개를 입고예정으로 고려합니다. 사용 가능 예정일이 각 주문의 배송 전날을 넘으면 해당 주문에는 사용할 수 없습니다.
          </Callout>
        ) : (
          <Callout tone={SLATE} title="주문 준비에 사용할 수 없는 입고예정">
            {blockReason}
          </Callout>
        )}
      </div>

      <section className="mt-6">
        <SectionTitle aside="입고 후 준비 상태가 갱신됩니다">
          입고 전후 관련 주문
        </SectionTitle>
        <UnblockedOrders key={s.code} scheduleCode={s.code} />
      </section>

      <section className="mt-6">
        <SectionTitle>입고 처리</SectionTitle>

        {isProduction && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="w-[52px] flex-none text-xs font-semibold text-ink-faint">품질검사</span>
            {(
              [
                { label: "통과", passed: true, on: inspected, tone: GREEN },
                { label: "불합격", passed: false, on: rejected, tone: ORANGE },
              ] as const
            ).map((b) => (
              <button
                key={b.label}
                type="button"
                aria-pressed={b.on}
                disabled={pending || remaining <= 0}
                onClick={() =>
                  run(
                    () => api.schedules.inspect(s.code, b.passed),
                    b.passed
                      ? `${s.code} 검사 통과 — 이제 입고할 수 있습니다.`
                      : `${s.code} 검사 불합격 — 통과 전까지 입고할 수 없습니다.`,
                  )
                }
                className="rounded-full border px-3.5 py-1.5 text-xs font-semibold enabled:cursor-pointer disabled:opacity-50"
                style={{
                  borderColor: b.on ? b.tone[0] : "var(--color-line)",
                  background: b.on ? b.tone[1] : "var(--color-surface)",
                  color: b.on ? b.tone[0] : "var(--color-ink-faint)",
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}

        {!s.confirmed && (
          <div className="mb-3">
            <Button
              variant="primary"
              disabled={pending}
              onClick={() =>
                run(
                  () => api.schedules.confirm(s.code),
                  `${s.code} 확정 — 준비 판단에 반영됩니다.`,
                )
              }
            >
              발주 확정하기
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-[9px] border border-line bg-surface">
            <button
              type="button"
              aria-label="입고수량 감소"
              disabled={qty <= 0}
              onClick={() => setQuantity(qty - 1)}
              className="grid h-9 w-9 place-items-center text-base text-ink-faint enabled:cursor-pointer enabled:hover:bg-canvas disabled:opacity-40"
            >
              −
            </button>
            <span className="num min-w-14 text-center text-[15px] font-bold">{qty}</span>
            <button
              type="button"
              aria-label="입고수량 증가"
              disabled={qty >= remaining}
              onClick={() => setQuantity(qty + 1)}
              className="grid h-9 w-9 place-items-center text-base text-ink-faint enabled:cursor-pointer enabled:hover:bg-canvas disabled:opacity-40"
            >
              +
            </button>
          </div>

          <Button
            size="sm"
            disabled={remaining <= 0 || qty === remaining}
            onClick={() => setQuantity(remaining)}
          >
            남은 전량 {remaining}
          </Button>

          <Button
            variant="primary"
            disabled={!canReceive || pending}
            onClick={() =>
              run(
                () => api.schedules.receive(s.code, qty, s.receivedQuantity),
                `${s.code} ${qty} 입고 — 현재고가 늘고 대기 주문이 준비 상태가 갱신됩니다.`,
              )
            }
          >
            {remaining > 0 ? `${qty} 입고 처리` : "입고 완료"}
          </Button>
        </div>

        <Hint>{hint}</Hint>
      </section>

      <section className="mt-6">
        <SectionTitle>이 문서를 만들게 한 주문</SectionTitle>
        {data.sourceOrderNumber ? (
          <Link
            href={`/orders?no=${data.sourceOrderNumber}`}
            className="flex items-center gap-2.5 rounded-[10px] border border-line px-3 py-2.5 transition-colors hover:border-accent hover:bg-accent-soft"
          >
            <span className="num text-xs font-bold text-accent">{data.sourceOrderNumber}</span>
            <span className="text-xs text-ink-faint">
              이 주문의 부족분으로 만들어진 문서입니다.
            </span>
          </Link>
        ) : (
          <p className="text-xs text-ink-dim">
            연결된 주문이 없습니다. 재고 보충 목적의 문서입니다.
          </p>
        )}
      </section>

      <section className="mt-6">
        <SectionTitle aside="같은 처리를 반복해도 늘지 않습니다">처리 이력</SectionTitle>
        <LedgerList
          empty="아직 처리 이력이 없습니다. 입고 처리를 해야 현재고가 늘어납니다."
          rows={data.ledgers.map((l, i) => ({
            key: `${l.createdAt}-${i}`,
            typeLabel: l.typeLabel,
            delta: signed(l.quantityDelta),
            color: deltaColor(l.quantityDelta),
            memo: l.memo ?? `${l.itemCode} · ${l.warehouseCode}`,
            at: toDateTime(l.createdAt).slice(5),
          }))}
        />
      </section>

      {isProduction && !inspected && remaining > 0 && (
        <div className="mt-4">
          <Callout tone={AMBER}>
            생산의뢰는 검사를 통과해야 입고할 수 있습니다. 위 품질검사에서 통과를 먼저
            눌러 주세요.
          </Callout>
        </div>
      )}
    </div>
  );
}
