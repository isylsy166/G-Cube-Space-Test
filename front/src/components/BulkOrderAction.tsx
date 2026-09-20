"use client";

import { useRouter } from "next/navigation";
import { useCommand } from "@/lib/hooks";
import { api } from "@/lib/api";
import { Button } from "./ui";
import type { ItemType } from "@/lib/types";

type Group = {
  itemCode: string;
  itemType: ItemType;
  totalShortage: number;
  blocked: { orderNumber: string; warehouseCode: string; warehouseActive: boolean }[];
};

/**
 * 같은 품목을 기다리는 여러 주문의 부족분을 한 문서로 묶어 발주한다. (요구사항 4-5)
 *
 * <p>주문마다 따로 발주하면 같은 공급처에 1~2개짜리 문서가 여러 건 나가고, 담당자는
 * 어느 문서가 어느 주문 것인지 세어야 한다. 부족분이 두 건 이상일 때만 이 버튼을 보여 준다.
 *
 * <p>한 문서는 한 창고로만 입고되므로, 창고가 섞여 있으면 묶을 수 없다고 먼저 알려 준다.
 */
export function BulkOrderAction({ group }: { group: Group }) {
  const { run, pending } = useCommand();
  const router = useRouter();

  if (group.blocked.length < 2) return null;

  const warehouses = [...new Set(group.blocked.map((b) => b.warehouseCode))];
  const mixed = warehouses.length > 1;
  const inactive = group.blocked.some((b) => !b.warehouseActive);
  const label = group.itemType === "MANUFACTURED" ? "생산의뢰" : "구매발주";

  return (
    <Button
      size="sm"
      variant={mixed || inactive ? "default" : "primary"}
      disabled={pending || mixed || inactive}
      title={
        mixed
          ? `출고창고가 ${warehouses.join(", ")} 로 섞여 있어 한 문서로 묶을 수 없습니다.`
          : inactive
            ? "사용 중지된 창고로 들어오는 주문이 섞여 있습니다."
            : `${group.blocked.length}건의 부족분 ${group.totalShortage}개를 한 문서로 발주합니다.`
      }
      onClick={async () => {
        const created = await run(
          () =>
            api.schedules.createBulk({
              orderNumbers: group.blocked.map((b) => b.orderNumber),
              itemCode: group.itemCode,
            }),
          `${group.blocked.length}건의 부족분을 한 문서로 묶어 발주했습니다.`,
        );
        if (created) router.push(`/schedules?code=${encodeURIComponent(created.code)}`);
      }}
    >
      {pending
        ? "등록 중…"
        : mixed
          ? "창고가 달라 묶을 수 없음"
          : `${group.blocked.length}건 묶어 ${label}`}
    </Button>
  );
}
