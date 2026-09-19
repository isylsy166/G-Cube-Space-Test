"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import { ItemDetailPanel } from "./ItemDetailPanel";
import { useItems } from "@/lib/hooks";
import { ITEM_TYPE_TONE } from "@/lib/tone";
import {
  Badge,
  Card,
  EmptyRow,
  SplitLayout,
  TableHead,
  TableRow,
} from "@/components/ui";

const COLS = "86px minmax(150px,1fr) 76px 74px 52px 58px 52px 52px";
const MIN_WIDTH = 740;

function ItemsWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const selected = params.get("code");

  const { data: items, isLoading, error } = useItems();

  const rows = useMemo(
    () =>
      (items ?? []).filter((i) => !q || `${i.code} ${i.name}`.toLowerCase().includes(q)),
    [items, q],
  );

  const setCode = (code: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("code", code);
    router.replace(`/items?${next}`, { scroll: false });
  };

  const activeCode =
    selected && rows.some((r) => r.code === selected) ? selected : (rows[0]?.code ?? null);

  useEffect(() => {
    if (activeCode && activeCode !== selected) setCode(activeCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCode, selected]);

  return (
    <SplitLayout
      list={
        <Card>
          <TableHead cols={COLS} minWidth={MIN_WIDTH}>
            <div>품목코드</div>
            <div>품목명</div>
            <div>분류</div>
            <div>품목유형</div>
            <div>시리얼</div>
            <div className="text-right">현재고</div>
            <div className="text-right">예약</div>
            <div className="text-right">가용</div>
          </TableHead>

          {error ? (
            <EmptyRow>품목을 불러오지 못했습니다. 백엔드가 실행 중인지 확인해 주세요.</EmptyRow>
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
                  onSelect={() => setCode(it.code)}
                >
                  <div className="font-mono text-[11.5px] font-medium">{it.code}</div>
                  <div className="truncate text-[12.5px]">{it.name}</div>
                  <div className="text-[11.5px] text-[--color-ink-faint]">{it.category}</div>
                  <div>
                    <Badge tone={ITEM_TYPE_TONE[it.type]} dot={false}>
                      {it.typeLabel}
                    </Badge>
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: it.serial ? "var(--color-accent)" : "#C8C8D2" }}
                  >
                    {it.serial ? "관리" : "—"}
                  </div>
                  <div className="text-right font-mono text-xs">
                    {stockless ? "—" : it.quantity}
                  </div>
                  <div className="text-right font-mono text-xs text-[--color-ink-dim]">
                    {stockless ? "—" : it.bookedQuantity}
                  </div>
                  <div
                    className="text-right font-mono text-xs font-semibold"
                    style={{
                      color: stockless
                        ? "#C8C8D2"
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
        </Card>
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
