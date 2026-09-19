"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { OrderDetailPanel } from "./OrderDetailPanel";
import { DemandRollup } from "./DemandRollup";
import { FilterRow, type FilterOption } from "@/components/FilterBar";
import { useOrders } from "@/lib/hooks";
import { ddayColor, ddayLabel, dateWithWeekday } from "@/lib/basetime";
import { READINESS_TONE } from "@/lib/tone";
import type { OrderSummary, ReadinessStatus } from "@/lib/types";
import {
  Badge,
  Card,
  EmptyRow,
  GroupHeader,
  SplitLayout,
  SummaryBanner,
  TableHead,
  TableRow,
} from "@/components/ui";

const COLS = "62px 136px minmax(110px,0.9fr) 76px minmax(200px,1.4fr)";
const MIN_WIDTH = 740;

/** 사이드바 KPI 와 같은 묶음. WAITING 은 입고를 기다리는 세 상태를 한데 본 것이다. */
const READINESS_GROUPS: Record<string, ReadinessStatus[]> = {
  READY: ["READY"],
  WAITING: ["WAIT_INSPECTION", "WAIT_PRODUCTION", "WAIT_PURCHASE"],
  SHORTAGE: ["SHORTAGE"],
  REVIEW_REQUIRED: ["REVIEW_REQUIRED"],
};

const READINESS_FILTERS = [
  { value: "READY", label: "바로 준비 가능" },
  { value: "WAITING", label: "입고 대기" },
  { value: "SHORTAGE", label: "재고 부족" },
  { value: "REVIEW_REQUIRED", label: "확인 필요" },
];

/** 준비가 막힌 주문은 줄 자체를 물들여 목록에서 먼저 눈에 띄게 한다. */
function rowWash(status: ReadinessStatus | null): string | undefined {
  if (status === "SHORTAGE") return "var(--color-bad-wash)";
  if (status === "REVIEW_REQUIRED") return "var(--color-review-wash)";
  return undefined;
}

function OrdersWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const [showRollup, setShowRollup] = useState(false);

  const q = (params.get("q") ?? "").trim().toLowerCase();
  const readiness = params.get("readiness") ?? "";
  const due = params.get("due") ?? "";
  const warehouse = params.get("wh") ?? "";
  const selected = params.get("no");

  // 준비 판정은 앞 주문이 재고를 먼저 가져가는 구조라 전체를 함께 봐야 뜻이 통한다.
  // 그래서 한 번에 받아 두고 거르기는 화면에서 한다.
  const { data: orders, isLoading, error } = useOrders();
  const all = useMemo(() => orders ?? [], [orders]);

  const matches = (o: OrderSummary, skip?: "due" | "wh" | "readiness") => {
    const group = READINESS_GROUPS[readiness];
    return (
      (skip === "due" || !due || o.deliveryAt.slice(0, 10) === due) &&
      (skip === "wh" || !warehouse || o.warehouseCode === warehouse) &&
      (skip === "readiness" ||
        !group ||
        (o.readinessStatus != null && group.includes(o.readinessStatus))) &&
      (!q || `${o.orderNumber} ${o.warehouseName} ${o.warehouseCode}`.toLowerCase().includes(q))
    );
  };

  const rows = useMemo(
    () => all.filter((o) => matches(o)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, q, readiness, due, warehouse],
  );

  // 각 칩의 건수는 그 축을 뺀 나머지 조건 기준으로 센다. 눌렀을 때 몇 건이 남는지 미리 보여 준다.
  const dueOptions: FilterOption[] = useMemo(() => {
    const dates = [...new Set(all.map((o) => o.deliveryAt.slice(0, 10)))].sort();
    return [
      { value: "", label: "전체", count: all.filter((o) => matches(o, "due")).length },
      ...dates.map((d) => ({
        value: d,
        label: `${d.slice(5).replace("-", "/")} ${ddayLabel(d)}`,
        count: all.filter((o) => o.deliveryAt.slice(0, 10) === d && matches(o, "due")).length,
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, q, readiness, warehouse]);

  const warehouseOptions: FilterOption[] = useMemo(() => {
    const seen = new Map<string, { name: string; active: boolean }>();
    for (const o of all)
      if (!seen.has(o.warehouseCode))
        seen.set(o.warehouseCode, { name: o.warehouseName, active: o.warehouseActive });
    return [
      { value: "", label: "전체", count: all.filter((o) => matches(o, "wh")).length },
      ...[...seen].map(([code, w]) => ({
        value: code,
        label: w.active ? w.name : `${w.name} · 사용 중지`,
        warn: !w.active,
        count: all.filter((o) => o.warehouseCode === code && matches(o, "wh")).length,
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, q, readiness, due]);

  const readinessOptions: FilterOption[] = useMemo(
    () => [
      { value: "", label: "전체", count: all.filter((o) => matches(o, "readiness")).length },
      ...READINESS_FILTERS.map((f) => ({
        ...f,
        count: all.filter(
          (o) =>
            o.readinessStatus != null &&
            READINESS_GROUPS[f.value].includes(o.readinessStatus) &&
            matches(o, "readiness"),
        ).length,
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, q, due, warehouse],
  );

  // 배송예정일이 빠른 주문부터. 서버가 이미 그 순서로 주므로 순서를 유지한 채 날짜로만 끊는다.
  const groups = useMemo(() => {
    const out: { date: string; orders: OrderSummary[] }[] = [];
    for (const o of rows) {
      const date = o.deliveryAt.slice(0, 10);
      if (out.at(-1)?.date !== date) out.push({ date, orders: [] });
      out.at(-1)!.orders.push(o);
    }
    return out;
  }, [rows]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // 조건을 바꾸면 이전 선택은 목록 밖일 수 있으므로 비우고 첫 줄로 다시 맞춘다.
    if (key !== "no") next.delete("no");
    router.replace(`/orders${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const activeNo =
    selected && rows.some((r) => r.orderNumber === selected)
      ? selected
      : (rows[0]?.orderNumber ?? null);

  useEffect(() => {
    if (activeNo && activeNo !== selected) setParam("no", activeNo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNo, selected]);

  const countOf = (key: string) =>
    rows.filter(
      (o) => o.readinessStatus != null && READINESS_GROUPS[key].includes(o.readinessStatus),
    ).length;

  return (
    <SplitLayout
      list={
        <>
          <div className="mb-3 flex flex-col gap-2">
            <FilterRow
              label="배송일"
              options={dueOptions}
              value={due}
              onChange={(v) => setParam("due", v)}
            />
            <FilterRow
              label="창고"
              options={warehouseOptions}
              value={warehouse}
              onChange={(v) => setParam("wh", v)}
            />
            <FilterRow
              label="준비상태"
              options={readinessOptions}
              value={readiness}
              onChange={(v) => setParam("readiness", v)}
            />
          </div>

          <SummaryBanner
            total={rows.length}
            items={[
              { label: "바로 준비", value: countOf("READY"), color: READINESS_TONE.READY[0] },
              {
                label: "입고 대기",
                value: countOf("WAITING"),
                color: READINESS_TONE.WAIT_PURCHASE[0],
              },
              { label: "재고 부족", value: countOf("SHORTAGE"), color: READINESS_TONE.SHORTAGE[0] },
              {
                label: "확인 필요",
                value: countOf("REVIEW_REQUIRED"),
                color: READINESS_TONE.REVIEW_REQUIRED[0],
              },
            ]}
          >
            <button
              type="button"
              aria-expanded={showRollup}
              onClick={() => setShowRollup((v) => !v)}
              className="cursor-pointer rounded-lg border border-[#dcdce6] bg-white px-3 py-1.5 text-[11.5px] font-medium text-[--color-ink-soft] hover:bg-[#fafafc]"
            >
              준비할 품목 {showRollup ? "접기" : "보기"}
            </button>
          </SummaryBanner>

          {showRollup && <DemandRollup orders={rows} />}

          <Card>
            <TableHead cols={COLS} minWidth={MIN_WIDTH}>
              <div>배송까지</div>
              <div>주문번호</div>
              <div>출고창고</div>
              <div>주문상태</div>
              <div>준비 상태</div>
            </TableHead>

            {error ? (
              <EmptyRow>주문을 불러오지 못했습니다. 백엔드가 실행 중인지 확인해 주세요.</EmptyRow>
            ) : isLoading ? (
              <EmptyRow>불러오는 중…</EmptyRow>
            ) : rows.length === 0 ? (
              <EmptyRow>조건에 맞는 주문이 없습니다. 필터를 풀어 보세요.</EmptyRow>
            ) : (
              groups.map((g) => (
                <div key={g.date}>
                  <GroupHeader
                    title={dateWithWeekday(g.date)}
                    meta={`${ddayLabel(g.date)} · ${g.orders.length}건`}
                  />
                  {g.orders.map((o) => (
                    <TableRow
                      key={o.orderNumber}
                      cols={COLS}
                      minWidth={MIN_WIDTH}
                      selected={o.orderNumber === activeNo}
                      onSelect={() => setParam("no", o.orderNumber)}
                      wash={rowWash(o.readinessStatus)}
                    >
                      <div
                        className="font-mono text-[11.5px] font-medium"
                        style={{ color: ddayColor(o.deliveryAt) }}
                      >
                        {ddayLabel(o.deliveryAt)}
                      </div>
                      <div className="font-mono text-[12.5px] font-medium">{o.orderNumber}</div>
                      <div
                        className="truncate text-xs"
                        style={{
                          color: o.warehouseActive
                            ? "var(--color-ink-faint)"
                            : "var(--color-bad)",
                        }}
                        title={o.warehouseActive ? undefined : "사용 중지된 창고입니다."}
                      >
                        {o.warehouseName}
                      </div>
                      <div className="text-[11.5px] text-[--color-ink-faint]">
                        {o.orderStatusLabel}
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        {o.readinessStatus ? (
                          <Badge tone={READINESS_TONE[o.readinessStatus]}>
                            {o.readinessStatusLabel}
                          </Badge>
                        ) : (
                          <span className="text-[11.5px] text-[--color-ink-ghost]">
                            준비 대상 아님
                          </span>
                        )}
                      </div>
                    </TableRow>
                  ))}
                </div>
              ))
            )}
          </Card>

          <p className="mt-3 max-w-[760px] text-[11.5px] leading-[1.7] text-pretty text-[--color-ink-dim]">
            배송예정일이 빠른 주문부터, 같은 날이면 접수가 빠른 주문부터 재고를 가져갑니다. 한
            주문은 모든 품목을 준비할 수 있을 때만 예약되며, 일부만 가능한 주문은 부분 예약하지
            않습니다.
          </p>
        </>
      }
      detail={<OrderDetailPanel orderNumber={activeNo} />}
    />
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersWorkspace />
    </Suspense>
  );
}
