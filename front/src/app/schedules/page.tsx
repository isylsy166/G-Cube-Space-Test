"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import { ScheduleDetailPanel } from "./ScheduleDetailPanel";
import { FilterRow, type FilterOption } from "@/components/FilterBar";
import { useSchedules } from "@/lib/hooks";
import { pct, toDate } from "@/lib/format";
import { ddayLabel } from "@/lib/basetime";
import { INSPECT_TONE, SCHEDULE_TYPE_TONE } from "@/lib/tone";
import type { StockSchedule } from "@/lib/types";
import {
  Badge,
  Card,
  EmptyRow,
  ProgressBar,
  SplitLayout,
  SummaryBanner,
  TableHead,
  TableRow,
} from "@/components/ui";

// 4-3 이 요구하는 항목을 모두 세운다. 넓어지는 만큼 표만 가로로 스크롤된다.
const COLS =
  "132px 52px minmax(130px,1fr) 104px 104px 46px 46px 46px 58px 84px 78px 72px";
const MIN_WIDTH = 1080;

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
          <div className="mb-3 flex flex-col gap-2">
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

          <SummaryBanner
            total={rows.length}
            items={[
              {
                label: "입고 남음",
                value: rows.filter((d) => d.remainingQuantity > 0).length,
                color: "var(--color-warn)",
              },
              {
                label: "입고 완료",
                value: rows.filter((d) => d.remainingQuantity <= 0).length,
                color: "var(--color-good)",
              },
              {
                label: "미확정",
                value: rows.filter((d) => !d.confirmed).length,
                color: "var(--color-bad)",
              },
            ]}
          />

          <Card>
            <TableHead cols={COLS} minWidth={MIN_WIDTH}>
              <div>문서번호</div>
              <div>구분</div>
              <div>품목</div>
              <div>입고창고</div>
              <div>공급처</div>
              <div className="text-right">계획</div>
              <div className="text-right">입고</div>
              <div className="text-right">남은</div>
              <div>진행률</div>
              <div>사용가능</div>
              <div>진행상태</div>
              <div>검사</div>
            </TableHead>

            {error ? (
              <EmptyRow>문서를 불러오지 못했습니다. 백엔드가 실행 중인지 확인해 주세요.</EmptyRow>
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
                  // 미확정 문서는 준비 판단에 쓰이지 않으므로 목록에서 구분해 둔다.
                  wash={!d.confirmed ? "var(--color-bad-wash)" : undefined}
                >
                  <div className="font-mono text-[11.5px] font-medium">{d.code}</div>
                  <div>
                    <Badge tone={SCHEDULE_TYPE_TONE[d.type]} dot={false}>
                      {d.typeLabel}
                    </Badge>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs">{d.itemName}</div>
                    <div className="truncate font-mono text-[10.5px] text-[--color-ink-ghost]">
                      {d.itemCode}
                    </div>
                  </div>
                  <div
                    className="truncate text-[11.5px]"
                    style={{
                      color: d.warehouseActive ? "var(--color-ink-faint)" : "var(--color-bad)",
                    }}
                    title={d.warehouseActive ? undefined : "사용 중지된 창고입니다."}
                  >
                    {d.warehouseName}
                  </div>
                  <div className="truncate text-[11.5px] text-[--color-ink-faint]">
                    {d.supplierName}
                  </div>
                  <div className="text-right font-mono text-xs">{d.planQuantity}</div>
                  <div className="text-right font-mono text-xs text-[--color-good]">
                    {d.receivedQuantity}
                  </div>
                  <div
                    className="text-right font-mono text-xs font-semibold"
                    style={{
                      color:
                        d.remainingQuantity > 0
                          ? "var(--color-warn)"
                          : "var(--color-ink-ghost)",
                    }}
                  >
                    {d.remainingQuantity}
                  </div>
                  <ProgressBar percent={pct(d.receivedQuantity, d.planQuantity)} />
                  <div className="font-mono text-[11px] text-[--color-ink-faint]">
                    <div>{toDate(d.availableAt)}</div>
                    <div className="text-[10px] text-[--color-ink-ghost]">
                      {ddayLabel(d.availableAt)}
                    </div>
                  </div>
                  <div
                    className="truncate text-[11px]"
                    style={{
                      color: d.confirmed ? "var(--color-ink-faint)" : "var(--color-bad)",
                    }}
                  >
                    {d.confirmed ? (d.statusLabel ?? "—") : "미확정"}
                  </div>
                  <div className="min-w-0">
                    {d.inspectStatus === "NOT_APPLICABLE" ? (
                      <span className="text-[11px] text-[--color-ink-ghost]">—</span>
                    ) : (
                      <Badge tone={INSPECT_TONE[d.inspectStatus]} dot={false}>
                        {d.inspectStatusLabel}
                      </Badge>
                    )}
                  </div>
                </TableRow>
              ))
            )}
          </Card>

          <p className="mt-3 max-w-[760px] text-[11.5px] leading-[1.7] text-pretty text-[--color-ink-dim]">
            발주를 만드는 것만으로는 현재고가 늘지 않습니다. 입고 처리 시점에만 재고가 늘고, 그
            재고를 기다리던 주문이 곧바로 다시 판정됩니다. 미확정 문서는 준비 판단에 쓰이지
            않습니다.
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
