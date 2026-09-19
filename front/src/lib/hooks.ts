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
 * 여러 주문의 상세를 한 번에. 배송일별 준비 품목 합계나, 어떤 발주가 풀어 줄 주문을
 * 찾을 때처럼 여러 주문의 준비 내역을 함께 봐야 하는 화면에서 쓴다.
 * SWR 항목 하나로 묶어 두고 안에서 병렬로 받는다.
 */
export const useOrderDetails = (orderNumbers: string[]) =>
  useSWR(
    orderNumbers.length > 0 ? ["order-details", [...orderNumbers].sort().join(",")] : null,
    () => Promise.all(orderNumbers.map((no) => api.orders.detail(no))),
  );

export const useItems = () => useSWR(["items"], () => api.items.list());

export const useItem = (code: string | null) =>
  useSWR(code ? ["item", code] : null, () => api.items.detail(code!));

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
