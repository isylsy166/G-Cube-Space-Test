"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useCommand, usePickableUnits } from "@/lib/hooks";
import { Button, SectionTitle } from "@/components/ui";

/**
 * 출고할 시리얼 개체를 담당자가 직접 고르는 자리.
 *
 * <p>목록은 조회 시점의 후보일 뿐이다. 다른 담당자가 먼저 집어간 개체는 배정할 때
 * 서버가 사유와 함께 막으므로, 화면에서 본 목록을 근거로 배정을 확정하지 않는다.
 */
export function SerialPicker({ orderNumber }: { orderNumber: string }) {
  const { data, isLoading, error } = usePickableUnits(orderNumber);
  const { run, pending } = useCommand();
  // 고른 개체는 주문마다 따로 남는다. 다른 주문을 열면 부모가 key 로 새로 만든다.
  const [selected, setSelected] = useState<string[]>([]);

  const groups = useMemo(() => data ?? [], [data]);
  // 예약수량을 넘겨 고르지 못하게 품목별로 남은 자리를 센다. 서버도 같은 기준으로 막는다.
  const chosenIn = (serials: string[]) => serials.filter((no) => selected.includes(no)).length;

  const toggle = (serialNumber: string) =>
    setSelected((prev) =>
      prev.includes(serialNumber)
        ? prev.filter((no) => no !== serialNumber)
        : [...prev, serialNumber],
    );

  const assign = async (serialNumbers?: string[]) => {
    const assigned = await run(
      () => api.orders.pick(orderNumber, serialNumbers),
      serialNumbers
        ? `${orderNumber} 선택한 제품 ${serialNumbers.length}개를 배정했습니다.`
        : `${orderNumber} 출고 제품을 자동으로 배정했습니다.`,
    );
    // 실패하면 고른 내용을 그대로 두어 사유를 보고 다시 고를 수 있게 한다.
    if (assigned) setSelected([]);
  };

  if (error)
    return (
      <section>
        <SectionTitle>출고 제품 선택</SectionTitle>
        <p className="text-xs text-bad">후보 제품을 불러오지 못했습니다. {String(error.message ?? "")}</p>
      </section>
    );
  if (isLoading || groups.length === 0) return null;

  return (
    <section>
      <SectionTitle aside="시리얼번호를 직접 고릅니다">출고 제품 선택</SectionTitle>
      <div className="flex flex-col gap-2">
        {groups.map((g) => {
          const chosen = chosenIn(g.candidates.map((u) => u.serialNumber));
          const full = chosen >= g.remainingQuantity;
          return (
            <div key={g.itemCode} className="overflow-hidden rounded-[10px] border border-line">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line bg-raised px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{g.itemName}</span>
                <span className="num text-[11px] text-ink-dim">
                  {g.warehouseCode} · 예약 {g.reservedQuantity} · 배정 {g.assignedQuantity}
                </span>
                <span
                  className="num text-[11px] font-bold"
                  style={{
                    color:
                      g.remainingQuantity > 0 ? "var(--color-accent)" : "var(--color-ink-ghost)",
                  }}
                >
                  {g.remainingQuantity > 0 ? `${chosen}/${g.remainingQuantity} 선택` : "배정 완료"}
                </span>
              </div>

              {g.candidates.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-ink-dim">
                  이 창고에 보관 중인 제품이 없습니다. 입고 후 다시 확인해 주세요.
                </p>
              ) : (
                <ul>
                  {g.candidates.map((u) => {
                    const checked = selected.includes(u.serialNumber);
                    // 남은 자리를 다 채웠으면 더 고를 수 없다. 이미 고른 것은 풀 수 있다.
                    const blocked = g.remainingQuantity === 0 || (full && !checked);
                    return (
                      <li key={u.serialNumber} className="border-b border-line-soft last:border-b-0">
                        <label
                          className={`flex items-center gap-2.5 px-3 py-2 ${
                            blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                          }`}
                          style={{ background: checked ? "var(--color-accent-soft)" : undefined }}
                        >
                          <input
                            type="checkbox"
                            className="size-3.5 shrink-0 accent-[var(--color-accent)]"
                            checked={checked}
                            disabled={blocked || pending}
                            onChange={() => toggle(u.serialNumber)}
                          />
                          <span className="num min-w-0 flex-1 truncate text-[13px] font-semibold">
                            {u.serialNumber}
                          </span>
                          <span className="num truncate text-[11px] text-ink-dim">
                            {u.location ?? "위치 미지정"}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={selected.length > 0 ? "primary" : "default"}
          disabled={selected.length === 0 || pending}
          title={selected.length === 0 ? "배정할 제품을 먼저 선택해 주세요." : undefined}
          onClick={() => assign(selected)}
        >
          선택한 {selected.length}개 배정
        </Button>
        <Button
          size="sm"
          disabled={pending}
          title="시리얼번호가 빠른 제품부터 필요한 수량만큼 자동으로 배정합니다."
          onClick={() => assign()}
        >
          자동 배정
        </Button>
        <span className="text-[11px] text-ink-faint">
          고르지 않고 자동 배정하면 시리얼번호가 빠른 제품부터 배정됩니다.
        </span>
      </div>
    </section>
  );
}
