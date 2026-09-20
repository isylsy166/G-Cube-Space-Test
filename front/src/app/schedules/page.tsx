"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import { ScheduleDetailPanel } from "./ScheduleDetailPanel";
import { FilterRow, type FilterOption } from "@/components/FilterBar";
import { useSchedules } from "@/lib/hooks";
import { pct, toDate } from "@/lib/format";
import { ddayColor, ddayLabel } from "@/lib/basetime";
import { INSPECT_TONE, SCHEDULE_TYPE_TONE } from "@/lib/tone";
import type { StockSchedule } from "@/lib/types";
import {
  Badge,
  Card,
  EmptyRow,
  ProgressBar,
  SplitLayout,
  TableHead,
  TableRow,
} from "@/components/ui";

// 4-3 이 요구하는 항목을 모두 세우되, 한 칸에 두 줄씩 쌓아 가로 폭을 줄인다.
const COLS = "124px minmax(148px,1fr) minmax(118px,0.8fr) 48px 48px 48px 88px 84px minmax(112px,0.8fr)";
const MIN_WIDTH = 1020;

const TYPE_FILTERS = [
  { value: "PURCHASE", label: "구매발주" },
  { value: "PRODUCTION", label: "생산의뢰" },
];

const PROGRESS_FILTERS = [
  { value: "OPEN", label: "입고 남음" },
  { value: "DONE", label: "입고 완료" },
];

const matchProgress = (d: StockSchedule, v: string) =>
  v === "OPEN" ? d.remainingQuantity > 0 : v === "DONE" ? d.remainingQuantity <= 0 : true;

const matchConfirm = (d: StockSchedule, v: string) =>
  v === "YES" ? d.confirmed : v === "NO" ? !d.confirmed : true;

function SchedulesWorkspace() {
  const router = useRouter();
  const params = useSearchParams();

  const q = (params.get("q") ?? "").trim().toLowerCase();
  const type = params.get("type") ?? "";
  const confirmed = params.get("confirmed") ?? "";
  const progress = params.get("progress") ?? "";
  const selected = params.get("code");

  // 제공된 문서와 앱에서 새로 만든 문서가 한 목록에 함께 보여야 하므로 전부 받아 화면에서 거른다.
  const { data, isLoading, error } = useSchedules();
  const all = useMemo(() => data ?? [], [data]);

  const matches = (d: StockSchedule, skip?: "type" | "confirmed" | "progress") =>
    (skip === "type" || !type || d.type === type) &&
    (skip === "confirmed" || matchConfirm(d, confirmed)) &&
    (skip === "progress" || matchProgress(d, progress)) &&
    (!q || `${d.code} ${d.itemName} ${d.itemCode} ${d.supplierName}`.toLowerCase().includes(q));

  const rows = useMemo(
    () => all.filter((d) => matches(d)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, q, type, confirmed, progress],
  );

  const opts = (
    skip: "type" | "confirmed" | "progress",
    list: { value: string; label: string }[],
    test: (d: StockSchedule, v: string) => boolean,
  ): FilterOption[] => [
    { value: "", label: "전체", count: all.filter((d) => matches(d, skip)).length },
    ...list.map((f) => ({
      ...f,
      count: all.filter((d) => test(d, f.value) && matches(d, skip)).length,
    })),
  ];

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "code") next.delete("code");
    router.replace(`/schedules${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const activeCode =
    selected && rows.some((r) => r.code === selected) ? selected : (rows[0]?.code ?? null);

  useEffect(() => {
    if (activeCode && activeCode !== selected) setParam("code", activeCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCode, selected]);

  return (
    <SplitLayout
      list={
        <>
          <div className="mb-3 flex flex-col gap-2 rounded-xl border border-line bg-surface px-3.5 py-3">
            <FilterRow
              label="구분"
              value={type}
              onChange={(v) => setParam("type", v)}
              options={opts("type", TYPE_FILTERS, (d, v) => d.type === v)}
            />
            <FilterRow
              label="확정여부"
              value={confirmed}
              onChange={(v) => setParam("confirmed", v)}
              options={opts(
                "confirmed",
                [
                  { value: "YES", label: "확정" },
                  { value: "NO", label: "미확정" },
                ],
                matchConfirm,
              )}
            />
            <FilterRow
              label="진행"
              value={progress}
              onChange={(v) => setParam("progress", v)}
              options={opts("progress", PROGRESS_FILTERS, matchProgress)}
            />
          </div>



          <Card>
            <div className="table-scroll">
              <TableHead cols={COLS} minWidth={MIN_WIDTH}>
                <div>문서번호 · 구분</div>
                <div>품목</div>
                <div>입고창고 · 공급처</div>
                <div className="text-right">계획</div>
                <div className="text-right">입고</div>
                <div className="text-right">남은</div>
                <div>진행률</div>
                <div>사용가능</div>
                <div>상태 · 검사</div>
              </TableHead>

              {error ? (
                <EmptyRow>문서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</EmptyRow>
              ) : isLoading ? (
                <EmptyRow>불러오는 중…</EmptyRow>
              ) : rows.length === 0 ? (
                <EmptyRow>조건에 맞는 문서가 없습니다. 필터를 풀어 보세요.</EmptyRow>
              ) : (
                rows.map((d) => (
                  <TableRow
                    key={d.code}
                    cols={COLS}
                    minWidth={MIN_WIDTH}
                    selected={d.code === activeCode}
                    onSelect={() => setParam("code", d.code)}
                    // 준비 판단에 쓰이지 못하는 문서는 목록에서 구분해 둔다.
                    wash={!d.usableForPlanning && d.remainingQuantity > 0 ? "var(--color-row-warn)" : undefined}
                  >
                    <div className="min-w-0">
                      <div className="num truncate text-[13px] font-semibold">{d.code}</div>
                      <div className="mt-0.5">
                        <Badge tone={SCHEDULE_TYPE_TONE[d.type]} dot={false}>
                          {d.typeLabel}
                        </Badge>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px]">{d.itemName}</div>
                      <div className="num truncate text-[11px] text-ink-dim">{d.itemCode}</div>
                    </div>
                    <div className="min-w-0">
                      <div
                        className="truncate text-xs"
                        style={{
                          color: d.warehouseActive ? "var(--color-ink-muted)" : "var(--color-bad)",
                        }}
                        title={d.warehouseActive ? undefined : "사용 중지된 창고입니다."}
                      >
                        {d.warehouseName}
                        {!d.warehouseActive && " · 중지"}
                      </div>
                      <div className="truncate text-[11px] text-ink-dim">{d.supplierName}</div>
                    </div>
                    <div className="num text-right text-[13px]">{d.planQuantity}</div>
                    <div className="num text-right text-[13px] font-semibold text-good">
                      {d.receivedQuantity}
                    </div>
                    <div
                      className="num text-right text-[13px] font-bold"
                      style={{
                        color:
                          d.remainingQuantity > 0 ? "var(--color-warn)" : "var(--color-ink-ghost)",
                      }}
                    >
                      {d.remainingQuantity}
                    </div>
                    <div>
                      <ProgressBar percent={pct(d.receivedQuantity, d.planQuantity)} />
                      <div className="num mt-1 text-[10.5px] text-ink-dim">
                        {pct(d.receivedQuantity, d.planQuantity)}%
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="num truncate text-[11.5px] text-ink-muted">
                        {toDate(d.availableAt)}
                      </div>
                      <div
                        className="num text-[10.5px] font-semibold"
                        style={{ color: ddayColor(d.availableAt) }}
                      >
                        {ddayLabel(d.availableAt)}
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      {d.confirmed ? (
                        <span className="truncate text-[11.5px] text-ink-muted">
                          {d.statusLabel ?? "—"}
                        </span>
                      ) : (
                        <span className="text-[11.5px] font-bold text-bad">미확정</span>
                      )}
                      {d.inspectStatus !== "NOT_APPLICABLE" && (
                        <Badge tone={INSPECT_TONE[d.inspectStatus]} dot={false}>
                          {d.inspectStatusLabel}
                        </Badge>
                      )}
                    </div>
                  </TableRow>
                ))
              )}
            </div>
          </Card>

          <p className="mt-3 max-w-[780px] text-xs leading-relaxed text-pretty text-ink-dim">
            발주를 만드는 것만으로는 현재고가 늘지 않습니다. 입고 처리 시점에만 재고가 늘고, 그
            입고를 기다리던 주문의 준비 상태가 갱신됩니다. 미확정·사용 중지 창고·검사 불합격
            문서는 준비 판단에 쓰이지 않습니다.
          </p>
        </>
      }
      detail={<ScheduleDetailPanel key={activeCode} code={activeCode} />}
    />
  );
}

export default function SchedulesPage() {
  return (
    <Suspense fallback={null}>
      <SchedulesWorkspace />
    </Suspense>
  );
}
