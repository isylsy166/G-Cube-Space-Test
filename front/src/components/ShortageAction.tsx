"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCommand, useItem } from "@/lib/hooks";
import { api } from "@/lib/api";
import { purchaseTiming } from "@/lib/fulfillment";
import { Button } from "./ui";

export function ShortageAction({ itemCode, orderNumber, deliveryAt, warehouseCode, quantity, warehouseActive }: {
  itemCode: string; orderNumber: string; deliveryAt: string; warehouseCode: string;
  quantity: number; warehouseActive: boolean;
}) {
  const { data, error } = useItem(itemCode);
  const { run, pending } = useCommand();
  const router = useRouter();
  const item = data?.item;
  // 기존 서버 응답에서도 같은 공급처의 문서에 명시된 소요 기간을 사용할 수 있다.
  const lead = item?.leadTimeDays ?? data?.schedules.find((schedule) => schedule.supplierCode === item?.supplierCode)?.leadTimeDays;
  const timing = purchaseTiming(deliveryAt, lead);
  const related = data?.schedules.filter((schedule) => schedule.warehouseCode === warehouseCode && schedule.remainingQuantity > 0) ?? [];
  const otherStock = data?.stocks.filter((stock) => stock.active && stock.warehouseCode !== warehouseCode && stock.availableQuantity > 0) ?? [];
  return (
    <div className="w-full rounded-lg border border-line bg-raised p-3 text-xs">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-ink-muted">
        <span>공급처 <strong className="block text-ink">{item?.supplierName ?? (error ? "조회 실패" : "확인 중…")}{lead !== undefined && ` · ${lead}일`}</strong></span>
        <span>필요 기한 <strong className="num block text-ink">{timing.deadline}</strong></span>
        <span>지금 발주 시 사용 가능 <strong className="num block text-ink">{timing.availableAt ?? "공급 일정 확인 필요"}</strong></span>
        <strong className={timing.onTime ? "text-good" : "text-bad"}>{timing.onTime === null ? "일정 확인 필요" : timing.onTime ? "기한 내 발주 가능" : "납기 조정 필요"}</strong>
      </div>
      {timing.onTime === false && <p className="mt-3 rounded-md bg-bad-wash p-2 leading-relaxed text-bad">지금 발주해도 필요 기한을 넘깁니다. 영업·CS에 배송일 조정을 먼저 요청하세요. 전달과 회신은 별도로 관리해 주세요.</p>}
      {related.map((schedule) => <Link key={schedule.code} href={`/schedules?code=${schedule.code}`} className="mt-2 block text-accent underline">
        {schedule.code} · {schedule.confirmed ? "확정" : "미확정"} · 남은 {schedule.remainingQuantity}개 · 사용 가능 {schedule.availableAt?.slice(0, 10) ?? "미정"}
        {!schedule.confirmed && " (확정 전에는 준비에 반영되지 않음)"}
        {schedule.availableAt && schedule.availableAt.slice(0, 10) > timing.deadline && " · 필요 기한 초과"}
      </Link>)}
      {otherStock.length > 0 && <Link href={`/items?code=${itemCode}`} className="mt-2 block leading-relaxed text-accent underline">다른 창고 재고: {otherStock.map((stock) => `${stock.warehouseName} ${stock.availableQuantity}개`).join(", ")} · 자동 사용되지 않으며 창고 이동은 별도 검토가 필요합니다.</Link>}
      <div className="mt-3">
        <Button size="sm" variant={timing.onTime ? "primary" : "default"}
          disabled={pending || !warehouseActive || timing.onTime !== true || !item}
          title={timing.onTime === false ? "배송일 조정 후 새 기한으로 발주 여부를 확인하세요." : undefined}
          onClick={async () => {
            const created = await run(() => api.orders.createSchedule(orderNumber, { itemCode, quantity }), "발주 문서를 만들었습니다. 확정 여부와 입고 일정을 확인하세요.");
            if (created) router.push(`/schedules?code=${encodeURIComponent(created.code)}`);
          }}>
          {pending ? "등록 중…" : `${item?.type === "MANUFACTURED" ? "생산의뢰" : "구매발주"} ${quantity}개 등록`}
        </Button>
      </div>
    </div>
  );
}
