import type {
  BulkScheduleCreateRequest,
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
  Supplier,
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

/**
 * 멱등 키. 발주 생성과 입고 처리는 상태만으로 중복을 가릴 수 없어 서버가 키를 요구한다.
 *
 * <p>키를 호출할 때마다 새로 만들면 네트워크 재시도만 막고, 담당자가 버튼을 두 번 누르는
 * 것은 막지 못한다. 그래서 **요청 내용 자체로** 키를 만든다. 같은 문서에 같은 수량을
 * 넣는 요청은 몇 번을 보내도 같은 키가 되어 서버가 한 번만 반영한다.
 *
 * <p>같은 수량을 의도적으로 한 번 더 넣는 것(분할 입고)은 업무적으로 정상이므로,
 * 입고 키에는 그 시점의 누적 입고수량을 함께 넣는다. 첫 입고가 반영되면 누적수량이
 * 달라져 다음 요청은 새 키가 된다.
 */
const idempotencyKey = (...parts: (string | number)[]) => parts.join(":");

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
          headers: {
            // 같은 주문의 같은 품목을 같은 수량으로 다시 눌러도 문서가 하나만 생긴다
            "Idempotency-Key": idempotencyKey(
              "po", orderNumber, body.itemCode, body.quantity ?? "auto",
            ),
          },
        },
      ),
  },

  suppliers: {
    list: () => request<Supplier[]>("/api/suppliers"),
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

    /**
     * 품질검사 결과. 통과 수량만큼만 입고할 수 있다.
     * 전량 합격/불합격뿐 아니라 부분 합격을 기록한다.
     */
    inspect: (code: string, passedQuantity: number) =>
      request<StockSchedule>(`/api/stock-schedules/${encodeURIComponent(code)}/inspection`, {
        method: "POST",
        body: JSON.stringify({ passedQuantity }),
      }),

    /** 여러 주문의 부족분을 한 문서로 묶어 발주한다. 같은 품목·같은 창고끼리만 묶인다. */
    createBulk: (body: BulkScheduleCreateRequest) =>
      request<StockSchedule>("/api/stock-schedules", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Idempotency-Key": idempotencyKey(
            "po-bulk",
            [...body.orderNumbers].sort().join("+"),
            body.itemCode,
            body.quantity ?? "auto",
          ),
        },
      }),

    /**
     * @param receivedQuantity 호출 시점의 누적 입고수량. 멱등 키에 실어, 같은 버튼을
     *   두 번 눌렀을 때는 한 번만 반영되고 첫 입고가 끝난 뒤의 추가 입고는 통과시킨다.
     */
    receive: (code: string, quantity: number, receivedQuantity: number) =>
      request<StockSchedule>(`/api/stock-schedules/${encodeURIComponent(code)}/receipt`, {
        method: "POST",
        body: JSON.stringify({ quantity }),
        headers: {
          "Idempotency-Key": idempotencyKey("rcv", code, receivedQuantity, quantity),
        },
      }),
  },
};
