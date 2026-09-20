"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useItemDetails } from "@/lib/hooks";
import { UNIT_STATUS_TONE } from "@/lib/tone";
import { Badge, Card, CardHeader, EmptyRow, GroupHeader, SummaryBanner } from "@/components/ui";
import type { ItemSummary, ItemUnitStatus } from "@/lib/types";

const COLS = "minmax(140px,1fr) minmax(120px,0.8fr) 90px minmax(130px,0.9fr)";
const MIN_WIDTH = 620;

/**
 * "어느 시리얼 제품이 어느 주문에 배정되었는가"에 답하는 표.
 * 개체는 품목 상세에만 들어 있으므로 시리얼 관리 품목의 상세만 모아 한 목록으로 편다.
 */
export function SerialBoard({ items }: { items: ItemSummary[] }) {
  const serialCodes = useMemo(
    () => items.filter((i) => i.serial).map((i) => i.code),
    [items],
  );
  const { data, isLoading, error } = useItemDetails(serialCodes);

  const groups = useMemo(() => {
    if (!data) return [];
    return data
      .map((d) => ({
        item: d.item,
        // 배정된 개체를 위로 올려 "어느 주문 것인지"가 먼저 보이게 한다.
        units: [...d.units].sort(
          (a, b) =>
            Number(Boolean(b.assignedOrderNumber)) - Number(Boolean(a.assignedOrderNumber)) ||
            a.serialNumber.localeCompare(b.serialNumber),
        ),
      }))
      .filter((g) => g.units.length > 0);
  }, [data]);

  const counts = useMemo(() => {
    const all = groups.flatMap((g) => g.units);
    const by = (s: ItemUnitStatus) => all.filter((u) => u.status === s).length;
    return {
      total: all.length,
      normal: by("NORMAL"),
      reserved: by("RESERVED"),
      sold: by("SOLD"),
      assigned: all.filter((u) => u.assignedOrderNumber).length,
    };
  }, [groups]);

  return (
    <>
      {groups.length > 0 && (
        <SummaryBanner
          total={counts.total}
          totalLabel="제품"
          items={[
            { label: "재고", value: counts.normal, color: UNIT_STATUS_TONE.NORMAL[0] },
            { label: "예약 배정", value: counts.reserved, color: UNIT_STATUS_TONE.RESERVED[0] },
            { label: "출고 완료", value: counts.sold, color: UNIT_STATUS_TONE.SOLD[0] },
            { label: "주문 배정됨", value: counts.assigned, color: "var(--color-accent)" },
          ]}
        />
      )}

      <Card>
        <CardHeader
          title="시리얼번호별 제품 배정 현황"
          desc="제품별 보관 위치와 배정된 주문을 확인하세요."
        />

        {error ? (
          <EmptyRow>제품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</EmptyRow>
        ) : isLoading ? (
          <EmptyRow>제품을 불러오는 중…</EmptyRow>
        ) : groups.length === 0 ? (
          <EmptyRow>시리얼로 관리하는 품목이 없습니다.</EmptyRow>
        ) : (
          <div className="table-scroll">
            <div style={{ minWidth: MIN_WIDTH }}>
              {groups.map((g) => (
                <section key={g.item.code}>
                  <GroupHeader
                    title={g.item.name}
                    meta={<span className="num">{g.item.code}</span>}
                  >
                    <span className="text-xs text-ink-faint">
                      제품 <strong className="num font-bold text-ink-soft">{g.units.length}</strong>
                      개 · 배정{" "}
                      <strong className="num font-bold text-ink-soft">
                        {g.units.filter((u) => u.assignedOrderNumber).length}
                      </strong>
                      개
                    </span>
                  </GroupHeader>

                  <div
                    className="grid gap-3 border-b border-line-soft bg-raised px-4 py-2 text-[11px] font-bold text-ink-faint"
                    style={{ gridTemplateColumns: COLS }}
                  >
                    <div>시리얼번호</div>
                    <div>보관 위치</div>
                    <div>상태</div>
                    <div>배정된 주문</div>
                  </div>

                  {g.units.map((u) => (
                    <div
                      key={u.serialNumber}
                      className="grid items-center gap-3 border-b border-line-soft px-4 py-2.5"
                      style={{
                        gridTemplateColumns: COLS,
                        background: u.assignedOrderNumber ? "var(--color-accent-soft)" : undefined,
                      }}
                    >
                      <div className="num truncate text-[13px] font-semibold">
                        {u.serialNumber}
                      </div>
                      <div className="num truncate text-xs text-ink-faint">
                        {u.warehouseCode}
                        {u.location ? ` · ${u.location}` : " · 위치 미지정"}
                      </div>
                      <div>
                        <Badge tone={UNIT_STATUS_TONE[u.status]} dot={false}>
                          {u.statusLabel}
                        </Badge>
                      </div>
                      <div className="num truncate text-xs">
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
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
