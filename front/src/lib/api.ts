import type {
  ItemDetail,
  ItemSummary,
  OrderDetail,
  OrderSummary,
  PickableUnits,
  ReadinessStatus,
  ScheduleCreateRequest,
  ScheduleDetail,
  ScheduleType,
  StockSchedule,
} from "./types";

/** 서버가 내려주는 업무 규칙 위반 사유를 그대로 들고 다니는 에러. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.", 0);
  }

  if (!res.ok) {
    // ApiExceptionHandler 는 { message } 를 내려준다. 그 밖의 오류는 상태코드로만 안내한다.
    const body = await res.json().catch(() => null);
    const message =
      body && typeof body.message === "string"
        ? body.message
        : `요청을 처리하지 못했습니다. (HTTP ${res.status})`;
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const query = (params: Record<string, string | boolean | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

/** 명령 API 는 재시도로 두 번 반영되지 않게 멱등 키를 붙인다. */
const idempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const api = {
  orders: {
    list: (filter?: {
      status?: string;
      readiness?: ReadinessStatus;
      warehouseCode?: string;
    }) => request<OrderSummary[]>(`/api/orders${query(filter ?? {})}`),

    detail: (orderNumber: string) =>
      request<OrderDetail>(`/api/orders/${encodeURIComponent(orderNumber)}`),

    reserve: (orderNumber: string) =>
      request<OrderDetail>(`/api/orders/${encodeURIComponent(orderNumber)}/reservation`, {
        method: "POST",
      }),

    /** 시리얼번호를 넘기면 그 개체만 배정하고, 넘기지 않으면 서버가 자동으로 고른다. */
    pick: (orderNumber: string, serialNumbers?: string[]) =>
      request<OrderDetail>(`/api/orders/${encodeURIComponent(orderNumber)}/picking`, {
        method: "POST",
        body: serialNumbers?.length ? JSON.stringify({ serialNumbers }) : undefined,
      }),

    /** 배정 해제. 잘못 고른 개체를 보관 중으로 되돌린다. */
    unpick: (orderNumber: string, serialNumber: string) =>
      request<OrderDetail>(
        `/api/orders/${encodeURIComponent(orderNumber)}/picking/${encodeURIComponent(serialNumber)}`,
        { method: "DELETE" },
      ),

    pickableUnits: (orderNumber: string) =>
      request<PickableUnits[]>(
        `/api/orders/${encodeURIComponent(orderNumber)}/pickable-units`,
      ),

    ship: (orderNumber: string) =>
      request<OrderDetail>(`/api/orders/${encodeURIComponent(orderNumber)}/shipment`, {
        method: "POST",
      }),

    createSchedule: (orderNumber: string, body: ScheduleCreateRequest) =>
      request<StockSchedule>(
        `/api/orders/${encodeURIComponent(orderNumber)}/purchase-orders`,
        {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Idempotency-Key": idempotencyKey() },
        },
      ),
  },

  items: {
    list: () => request<ItemSummary[]>("/api/items"),
    detail: (code: string) => request<ItemDetail>(`/api/items/${encodeURIComponent(code)}`),
  },

  schedules: {
    list: (filter?: {
      type?: ScheduleType;
      warehouseCode?: string;
      itemCode?: string;
      confirmed?: boolean;
    }) => request<StockSchedule[]>(`/api/stock-schedules${query(filter ?? {})}`),

    detail: (code: string) =>
      request<ScheduleDetail>(`/api/stock-schedules/${encodeURIComponent(code)}`),

    confirm: (code: string) =>
      request<StockSchedule>(`/api/stock-schedules/${encodeURIComponent(code)}/confirmation`, {
        method: "POST",
      }),

    inspect: (code: string, passed: boolean) =>
      request<StockSchedule>(`/api/stock-schedules/${encodeURIComponent(code)}/inspection`, {
        method: "POST",
        body: JSON.stringify({ passed }),
      }),

    receive: (code: string, quantity: number) =>
      request<StockSchedule>(`/api/stock-schedules/${encodeURIComponent(code)}/receipt`, {
        method: "POST",
        body: JSON.stringify({ quantity }),
        headers: { "Idempotency-Key": idempotencyKey() },
      }),
  },
};
