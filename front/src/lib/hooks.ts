"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback, useState } from "react";
import { api, ApiError } from "./api";
import { useToast } from "@/components/Toast";
import type { ReadinessStatus, ScheduleType } from "./types";

/** 목록과 상세가 서로 물려 있어서, 명령 뒤에는 화면에 떠 있는 모든 키를 한 번에 새로 고친다. */
export function useRefreshAll() {
  const { mutate } = useSWRConfig();
  return useCallback(() => mutate(() => true, undefined, { revalidate: true }), [mutate]);
}

export const useOrders = (filter?: {
  readiness?: ReadinessStatus;
  warehouseCode?: string;
}) =>
  useSWR(["orders", filter?.readiness ?? "", filter?.warehouseCode ?? ""], () =>
    api.orders.list(filter),
  );

export const useOrder = (orderNumber: string | null) =>
  useSWR(orderNumber ? ["order", orderNumber] : null, () => api.orders.detail(orderNumber!));

/**
 * 출고할 개체를 직접 고를 때 쓰는 후보 목록. 배정 화면을 열었을 때만 읽는다.
 * 조회 시점의 후보일 뿐이라, 먼저 집어간 개체는 배정 시점에 서버가 사유와 함께 막는다.
 */
export const usePickableUnits = (orderNumber: string | null) =>
  useSWR(orderNumber ? ["pickable-units", orderNumber] : null, () =>
    api.orders.pickableUnits(orderNumber!),
  );

export const useItems = () => useSWR(["items"], () => api.items.list());

/** 발주 화면에서 공급처를 고를 때 쓴다. 거의 바뀌지 않아 한 번 받아 두고 재사용한다. */
export const useSuppliers = () =>
  useSWR(["suppliers"], () => api.suppliers.list(), { revalidateOnFocus: false });

export const useItem = (code: string | null) =>
  useSWR(code ? ["item", code] : null, () => api.items.detail(code!));

/**
 * 시리얼 개체 전부. 품목을 가로질러 "어느 제품이 어느 주문에 배정됐는지" 를 볼 때 쓴다.
 * 품목마다 상세를 부르면 요청이 품목 수만큼 늘고 준비 판정도 그만큼 다시 도므로,
 * 서버가 품목별로 묶어 준 한 건만 받는다.
 */
export const useItemUnits = () => useSWR(["item-units"], () => api.items.units());

export const useSchedules = (filter?: { type?: ScheduleType; confirmed?: boolean }) =>
  useSWR(["schedules", filter?.type ?? "", String(filter?.confirmed ?? "")], () =>
    api.schedules.list(filter),
  );

export const useSchedule = (code: string | null) =>
  useSWR(code ? ["schedule", code] : null, () => api.schedules.detail(code!));

/**
 * 명령 실행 공통 처리.
 * 성공/실패 모두 토스트로 알리고, 성공하면 열려 있는 데이터를 다시 읽는다.
 * 실행 중에는 pending 이 true 라 버튼을 이중으로 누를 수 없다.
 */
export function useCommand() {
  const toast = useToast();
  const refresh = useRefreshAll();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async <T,>(action: () => Promise<T>, successMessage: string): Promise<T | null> => {
      if (pending) return null;
      setPending(true);
      try {
        const result = await action();
        await refresh();
        toast(successMessage, true);
        return result;
      } catch (e) {
        // 업무 규칙 위반 사유는 서버 문구가 가장 정확하므로 그대로 보여 준다.
        toast(e instanceof ApiError ? e.message : "알 수 없는 오류가 발생했습니다.", false);
        return null;
      } finally {
        setPending(false);
      }
    },
    [pending, refresh, toast],
  );

  return { run, pending };
}
