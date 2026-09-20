"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCommand, useItem, useSuppliers } from "@/lib/hooks";
import { api } from "@/lib/api";
import { purchaseTiming, shiftDate } from "@/lib/fulfillment";
import { BASE_DATE } from "@/lib/basetime";
import { Button, Hint } from "./ui";

/**
 * 부족 품목에서 발주를 만드는 자리.
 *
 * <p>버튼만 두지 않고 "지금 발주하면 이 주문의 배송일에 맞는가" 를 먼저 계산해 보여 준다.
 * 담당자가 눌러 놓고 나중에 납기를 놓치는 상황을 화면이 먼저 막는다.
 *
 * <p>기본 공급처로 기한을 못 맞추면 다른 공급처를 골라 다시 계산할 수 있다.
 * 사용 가능 예정일도 직접 고칠 수 있다 — 공급처와 협의한 날짜가 리드타임과 다를 수 있다.
 */
export function ShortageAction({ itemCode, orderNumber, deliveryAt, warehouseCode, quantity, warehouseActive }: {
  itemCode: string; orderNumber: string; deliveryAt: string; warehouseCode: string;
  quantity: number; warehouseActive: boolean;
}) {
  const { data, error } = useItem(itemCode);
  const { data: suppliers } = useSuppliers();
  const { run, pending } = useCommand();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [supplierCode, setSupplierCode] = useState<string | null>(null);
  const [availableAt, setAvailableAt] = useState<string | null>(null);

  const item = data?.item;
  // 기존 서버 응답에서도 같은 공급처의 문서에 명시된 소요 기간을 사용할 수 있다.
  const defaultLead = item?.leadTimeDays ?? data?.schedules.find((schedule) => schedule.supplierCode === item?.supplierCode)?.leadTimeDays;

  const chosen = suppliers?.find((s) => s.code === supplierCode);
  const lead = chosen?.leadTimeDays ?? defaultLead;
  const timing = purchaseTiming(deliveryAt, lead);
  // 담당자가 날짜를 직접 고쳤으면 그 날짜로 기한을 다시 따진다.
  const effectiveAvailableAt = availableAt ?? timing.availableAt;
  const onTime = effectiveAvailableAt === null ? null : effectiveAvailableAt <= timing.deadline;

  const related = data?.schedules.filter((schedule) => schedule.warehouseCode === warehouseCode && schedule.remainingQuantity > 0) ?? [];
  const otherStock = data?.stocks.filter((stock) => stock.active && stock.warehouseCode !== warehouseCode && stock.availableQuantity > 0) ?? [];

  return (
    <div className="w-full rounded-lg border border-line bg-raised p-3 text-xs">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-ink-muted">
        <span>공급처 <strong className="block text-ink">{chosen?.name ?? item?.supplierName ?? (error ? "조회 실패" : "확인 중…")}{lead !== undefined && ` · ${lead}일`}</strong></span>
        <span>필요 기한 <strong className="num block text-ink">{timing.deadline}</strong></span>
        <span>사용 가능 예정 <strong className="num block text-ink">{effectiveAvailableAt ?? "공급 일정 확인 필요"}</strong></span>
        <strong className={onTime ? "text-good" : "text-bad"}>{onTime === null ? "일정 확인 필요" : onTime ? "기한 내 발주 가능" : "납기 조정 필요"}</strong>
      </div>

      {onTime === false && <p className="mt-3 rounded-md bg-bad-wash p-2 leading-relaxed text-bad">지금 발주해도 필요 기한을 넘깁니다. 공급처를 바꿔 보거나, 영업·CS에 배송일 조정을 먼저 요청하세요. 전달과 회신은 별도로 관리해 주세요.</p>}

      {related.map((schedule) => <Link key={schedule.code} href={`/schedules?code=${schedule.code}`} className="mt-2 block text-accent underline">
        {schedule.code} · {schedule.confirmed ? "확정" : "미확정"} · 남은 {schedule.remainingQuantity}개 · 사용 가능 {schedule.availableAt?.slice(0, 10) ?? "미정"}
        {!schedule.confirmed && " (확정 전에는 준비에 반영되지 않음)"}
        {schedule.availableAt && schedule.availableAt.slice(0, 10) > timing.deadline && " · 필요 기한 초과"}
      </Link>)}

      {otherStock.length > 0 && <Link href={`/items?code=${itemCode}`} className="mt-2 block leading-relaxed text-accent underline">다른 창고 재고: {otherStock.map((stock) => `${stock.warehouseName} ${stock.availableQuantity}개`).join(", ")} · 자동 사용되지 않으며 창고 이동은 별도 검토가 필요합니다.</Link>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={onTime ? "primary" : "default"}
          disabled={pending || !warehouseActive || !item}
          title={onTime === false ? "기한을 넘기는 일정입니다. 공급처나 배송일을 먼저 조정하세요." : undefined}
          onClick={async () => {
            const created = await run(
              () => api.orders.createSchedule(orderNumber, {
                itemCode,
                quantity,
                supplierCode: supplierCode ?? undefined,
                availableAt: availableAt ?? undefined,
              }),
              "발주 문서를 만들었습니다. 확정 여부와 입고 일정을 확인하세요.",
            );
            if (created) router.push(`/schedules?code=${encodeURIComponent(created.code)}`);
          }}>
          {pending ? "등록 중…" : `${item?.type === "MANUFACTURED" ? "생산의뢰" : "구매발주"} ${quantity}개 등록`}
        </Button>

        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "기본값으로" : "공급처·날짜 고르기"}
        </Button>
      </div>

      {open && (
        <div className="mt-2.5 flex flex-wrap items-end gap-2 border-t border-line pt-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-faint">공급처</span>
            <select
              value={supplierCode ?? item?.supplierCode ?? ""}
              onChange={(e) => { setSupplierCode(e.target.value); setAvailableAt(null); }}
              className="h-8 rounded-md border border-line bg-surface px-2 text-xs"
            >
              {suppliers?.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} · {s.typeLabel} · {s.leadTimeDays}일
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-faint">사용 가능 예정일</span>
            <input
              type="date"
              value={effectiveAvailableAt ?? shiftDate(BASE_DATE, 0)}
              min={BASE_DATE}
              onChange={(e) => setAvailableAt(e.target.value)}
              className="num h-8 rounded-md border border-line bg-surface px-2 text-xs"
            />
          </label>
          <Hint>
            공급처를 바꾸면 리드타임이 달라져 사용 가능 예정일이 다시 계산됩니다.
            협의한 날짜가 따로 있으면 직접 고쳐 주세요.
          </Hint>
        </div>
      )}
    </div>
  );
}
