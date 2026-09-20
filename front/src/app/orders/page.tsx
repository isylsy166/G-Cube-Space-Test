"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import { OrderDetailPanel } from "./OrderDetailPanel";
import { DemandRollup } from "./DemandRollup";
import { ShortageBoard } from "./ShortageBoard";
import type { FilterOption } from "@/components/FilterBar";
import { OrderQuery } from "@/components/OrderQuery";
import { useOrders } from "@/lib/hooks";
import { BASE_DATE, ddayColor, ddayLabel, dateWithWeekday } from "@/lib/basetime";
import { shiftDate } from "@/lib/fulfillment";
import { READINESS_TONE } from "@/lib/tone";
import type { OrderSummary, ReadinessStatus } from "@/lib/types";
import {
  Badge,
  Card,
  EmptyRow,
  GroupHeader,
  SplitLayout,
  Tabs,
  TableHead,
  TableRow,
} from "@/components/ui";

const COLS = "146px minmax(100px,1fr) 80px minmax(150px,1.2fr)";
const MIN_WIDTH = 540;

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

type View = "orders" | "demand" | "shortage";

/** 준비가 막힌 주문은 줄 자체를 물들여 목록에서 먼저 눈에 띄게 한다. */
function rowWash(status: ReadinessStatus | null): string | undefined {
  if (status === "SHORTAGE") return "var(--color-row-bad)";
  if (status === "REVIEW_REQUIRED") return "var(--color-row-review)";
  return undefined;
}

function OrdersWorkspace() {
  const router = useRouter();
  const params = useSearchParams();

  const q = (params.get("q") ?? "").trim().toLowerCase();
  const readiness = params.get("readiness") ?? "";
  const due = params.get("due") ?? "";
  const warehouse = params.get("wh") ?? "";
  const selected = params.get("no");
  const unreserved = params.get("unreserved") === "1";
  const view = (params.get("view") ?? "orders") as View;

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
    () => all.filter((o) => matches(o) && (!unreserved || (o.preparationTarget && !o.reserved))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, q, readiness, due, warehouse, unreserved],
  );

  /** 품목 집계 화면은 준비상태로 좁히면 수요가 반 토막 나므로 그 축만 뺀 범위를 쓴다. */
  const rollupRows = useMemo(
    () => all.filter((o) => matches(o, "readiness")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, q, due, warehouse],
  );

  // 각 칩의 건수는 그 축을 뺀 나머지 조건 기준으로 센다. 눌렀을 때 몇 건이 남는지 미리 보여 준다.
  const defaultDeliveryDate = useMemo(
    () => all.map((order) => order.deliveryAt.slice(0, 10)).sort()[0] ?? BASE_DATE,
    [all],
  );

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
    if (key !== "no" && key !== "view") next.delete("no");
    router.replace(`/orders${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  // 아무것도 안 고른 상태에서는 준비 대상 주문을 먼저 편다.
  // 목록 맨 위는 이미 출고가 끝난 주문일 수 있고, 그 상세에는 할 일이 없다.
  const activeNo =
    selected && rows.some((r) => r.orderNumber === selected)
      ? selected
      : (rows.find((r) => r.preparationTarget)?.orderNumber ?? rows[0]?.orderNumber ?? null);

  useEffect(() => {
    if (activeNo && activeNo !== selected) setParam("no", activeNo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNo, selected]);

  const selectStatus = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("readiness", value);
    else next.delete("readiness");
    next.delete("view");
    next.delete("no");
    router.replace(`/orders${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <>
      <div className="px-6 pt-5">
        <OrderQuery
          date={due} defaultDate={defaultDeliveryDate}
          warehouse={warehouse} warehouses={warehouseOptions}
          statuses={readinessOptions} status={view === "orders" ? readiness : null}
          loading={isLoading} error={!!error}
          excludedCount={rollupRows.filter((order) => !order.readinessStatus).length}
          onDate={(value) => setParam("due", value)}
          onWarehouse={(value) => setParam("wh", value)}
          onStatus={selectStatus} filtered={!!(q || due || warehouse || readiness || unreserved)}
          onReset={() => {
            const next = new URLSearchParams(params.toString());
            ["q", "due", "wh", "readiness", "no", "unreserved"].forEach((key) => next.delete(key));
            router.replace(`/orders${next.size ? `?${next}` : ""}`, { scroll: false });
          }}
        />
      </div>
      <SplitLayout
        list={
          <>
          <Tabs<View>
            value={view}
            onChange={(v) => {
              const next = new URLSearchParams(params.toString());
              if (v === "orders") next.delete("view"); else next.set("view", v);
              next.delete("readiness");
              next.delete("no");
              router.replace(`/orders${next.size ? `?${next}` : ""}`, { scroll: false });
            }}
            tabs={[
              { value: "orders", label: "주문 목록" },
              { value: "demand", label: "배송일별 준비 품목" },
              {
                value: "shortage",
                label: "부족 품목 발주",
                color: "var(--color-bad)",
              },
            ]}
          />

          {view === "demand" ? (
            <DemandRollup orders={rollupRows} />
          ) : view === "shortage" ? (
            <ShortageBoard orders={rollupRows} />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-ink-faint">배송일·접수 순으로 배정 · 발주 마감 15:00</span>
                <label className="flex cursor-pointer items-center gap-2 font-medium"><input type="checkbox" checked={unreserved} onChange={(event) => setParam("unreserved", event.target.checked ? "1" : "")} />미예약 주문만</label>
              </div>
              <Card>
                <div className="table-scroll">
                  <TableHead cols={COLS} minWidth={MIN_WIDTH}>
                    <div>주문번호</div>
                    <div>출고창고</div>
                    <div>주문상태</div>
                    <div>준비 상태 · 확인할 사항</div>
                  </TableHead>

                  {error ? (
                    <EmptyRow>
                      주문을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                    </EmptyRow>
                  ) : isLoading ? (
                    <EmptyRow>불러오는 중…</EmptyRow>
                  ) : rows.length === 0 ? (
                    <EmptyRow>조건에 맞는 주문이 없습니다. 조회 조건을 변경하거나 초기화해 주세요.</EmptyRow>
                  ) : (
                    groups.map((g) => (
                      <div key={g.date}>
                        <GroupHeader
                          title={dateWithWeekday(g.date)}
                          meta={
                            <>
                              <span style={{ color: ddayColor(g.date) }} className="font-semibold">
                                {ddayLabel(g.date)}
                              </span>
                              {` · ${g.orders.length}건`}
                            </>
                          }
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
                            <div className="num text-[13px] font-semibold">{o.orderNumber}</div>
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
                            <div className="text-xs text-ink-faint">{o.orderStatusLabel}</div>
                            <div className="flex min-w-0 flex-col items-start gap-1.5">
                              {o.readinessStatus ? (
                                <>
                                  <Badge tone={READINESS_TONE[o.readinessStatus]}>
                                    {o.readinessStatusLabel}
                                  </Badge>
                                  <span className="text-[11px] leading-relaxed text-ink-muted">
                                    {o.readinessStatus.startsWith("WAIT_")
                                      ? `${shiftDate(o.deliveryAt, -1)}까지 입고 필요`
                                      : o.readinessStatus === "REVIEW_REQUIRED"
                                        ? o.reviewReasons.join(" · ") || "상세에서 사유 확인"
                                        : o.readinessStatus === "SHORTAGE"
                                          ? "공급 일정과 필요 기한 비교"
                                          : o.picked
                                            ? "출고 제품 배정됨"
                                            : o.reserved
                                              ? "재고 예약됨"
                                              : "미예약 · 재고 예약 필요"}
                                  </span>

                                </>
                              ) : (
                                <span className="text-xs text-ink-ghost">준비 대상 아님</span>
                              )}
                            </div>
                          </TableRow>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <p className="mt-3 max-w-[780px] text-xs leading-relaxed text-pretty text-ink-dim">
                배송일이 빠른 순서로 재고를 배정하며, 배송일이 같으면 먼저 접수된 주문이 우선입니다.
                재고 예약은 모든 품목을 준비할 수 있을 때 가능합니다.
              </p>
            </>
          )}
        </>
      }
      detail={<OrderDetailPanel orderNumber={activeNo} />}
      />
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersWorkspace />
    </Suspense>
  );
}
