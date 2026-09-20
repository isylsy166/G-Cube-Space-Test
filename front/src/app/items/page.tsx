"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import { ItemDetailPanel } from "./ItemDetailPanel";
import { SerialBoard } from "./SerialBoard";
import { FilterRow, type FilterOption } from "@/components/FilterBar";
import { useItems } from "@/lib/hooks";
import { ITEM_TYPE_TONE } from "@/lib/tone";
import type { ItemSummary, ItemType } from "@/lib/types";
import {
  Badge,
  Card,
  EmptyRow,
  SplitLayout,
  Tabs,
  TableHead,
  TableRow,
} from "@/components/ui";

const COLS = "92px minmax(150px,1fr) 84px 78px 56px 62px 62px 68px";
const MIN_WIDTH = 760;

const TYPE_FILTERS: { value: ItemType; label: string }[] = [
  { value: "PURCHASED", label: "구매품" },
  { value: "MANUFACTURED", label: "생산품" },
  { value: "SERVICE", label: "서비스" },
];

type View = "stock" | "serial";

function ItemsWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const type = params.get("type") ?? "";
  const selected = params.get("code");
  const view = (params.get("view") ?? "stock") as View;

  const { data: items, isLoading, error } = useItems();
  const all = useMemo(() => items ?? [], [items]);

  const matches = (i: ItemSummary, skip?: "type") =>
    (skip === "type" || !type || i.type === type) &&
    (!q || `${i.code} ${i.name} ${i.category}`.toLowerCase().includes(q));

  const rows = useMemo(
    () => all.filter((i) => matches(i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, q, type],
  );

  const typeOptions: FilterOption[] = useMemo(
    () => [
      { value: "", label: "전체", count: all.filter((i) => matches(i, "type")).length },
      ...TYPE_FILTERS.map((f) => ({
        ...f,
        count: all.filter((i) => i.type === f.value && matches(i, "type")).length,
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, q],
  );

  const stats = useMemo(() => {
    const stocked = rows.filter((i) => i.type !== "SERVICE");
    return {
      usable: stocked.filter((i) => i.availableQuantity > 0).length,
      none: stocked.filter((i) => i.availableQuantity <= 0).length,
      booked: stocked.filter((i) => i.bookedQuantity > 0).length,
      serial: rows.filter((i) => i.serial).length,
    };
  }, [rows]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "code" && key !== "view") next.delete("code");
    router.replace(`/items${next.size ? `?${next}` : ""}`, { scroll: false });
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
          <div className="mb-3 rounded-xl border border-line bg-surface px-3.5 py-3">
            <FilterRow
              label="품목유형"
              options={typeOptions}
              value={type}
              onChange={(v) => setParam("type", v)}
            />
          </div>

          <Tabs<View>
            value={view}
            onChange={(v) => setParam("view", v === "stock" ? "" : v)}
            tabs={[
              { value: "stock", label: "현재고 · 가용재고", count: rows.length },
              { value: "serial", label: "시리얼 배정 현황", count: stats.serial },
            ]}
          />

          {view === "serial" ? (
            <SerialBoard items={rows} />
          ) : (
            <>


              <Card>
                <div className="table-scroll">
                  <TableHead cols={COLS} minWidth={MIN_WIDTH}>
                    <div>품목코드</div>
                    <div>품목명</div>
                    <div>분류</div>
                    <div>품목유형</div>
                    <div>시리얼</div>
                    <div className="text-right">현재고</div>
                    <div className="text-right text-ink-dim">− 예약</div>
                    <div className="text-right text-good">= 가용</div>
                  </TableHead>

                  {error ? (
                    <EmptyRow>
                      품목을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                    </EmptyRow>
                  ) : isLoading ? (
                    <EmptyRow>불러오는 중…</EmptyRow>
                  ) : rows.length === 0 ? (
                    <EmptyRow>검색 결과가 없습니다.</EmptyRow>
                  ) : (
                    rows.map((it) => {
                      // 서비스 품목은 재고를 차지하지 않으므로 수량 칸을 비운다.
                      const stockless = it.type === "SERVICE";
                      return (
                        <TableRow
                          key={it.code}
                          cols={COLS}
                          minWidth={MIN_WIDTH}
                          selected={it.code === activeCode}
                          onSelect={() => setParam("code", it.code)}
                          wash={
                            !stockless && it.availableQuantity <= 0
                              ? "var(--color-row-bad)"
                              : undefined
                          }
                        >
                          <div className="num text-[13px] font-semibold">{it.code}</div>
                          <div className="truncate text-[13px]">{it.name}</div>
                          <div className="truncate text-xs text-ink-faint">{it.category}</div>
                          <div>
                            <Badge tone={ITEM_TYPE_TONE[it.type]} dot={false}>
                              {it.typeLabel}
                            </Badge>
                          </div>
                          <div
                            className="text-[11px] font-semibold"
                            style={{ color: it.serial ? "var(--color-accent)" : "#C2C7D2" }}
                          >
                            {it.serial ? "관리" : "—"}
                          </div>
                          <div className="num text-right text-[13px]">
                            {stockless ? "—" : it.quantity}
                          </div>
                          <div className="num text-right text-[13px] text-ink-dim">
                            {stockless ? "—" : it.bookedQuantity}
                          </div>
                          <div
                            className="num text-right text-[15px] font-bold"
                            style={{
                              color: stockless
                                ? "#C2C7D2"
                                : it.availableQuantity > 0
                                  ? "var(--color-good)"
                                  : "var(--color-bad)",
                            }}
                          >
                            {stockless ? "—" : it.availableQuantity}
                          </div>
                        </TableRow>
                      );
                    })
                  )}
                </div>
              </Card>

              <p className="mt-3 max-w-[780px] text-xs leading-relaxed text-pretty text-ink-dim">
                가용재고는 현재고에서 기존 예약을 뺀 수량입니다. 예약은 현재고를 줄이지 않으므로,
                지금 새 주문에 쓸 수 있는 수량은 언제나 맨 오른쪽 칸입니다. 사용 중지된 창고의
                수량은 준비 판단에서 빠집니다.
              </p>
            </>
          )}
        </>
      }
      detail={<ItemDetailPanel code={activeCode} />}
    />
  );
}

export default function ItemsPage() {
  return (
    <Suspense fallback={null}>
      <ItemsWorkspace />
    </Suspense>
  );
}
