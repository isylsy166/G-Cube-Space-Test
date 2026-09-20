"use client";

const STEPS = [
  { label: "주문 접수", note: "주문 내용 확인" },
  { label: "재고 예약", note: "주문 수량 확보" },
  { label: "출고 제품 배정", note: "시리얼번호 연결" },
  { label: "출고 완료", note: "재고 반영" },
] as const;

/** 주문 진행 단계 레일. 지나온 단계는 채워지고, 지금 단계만 진하게 둔다. */
export function OrderRail({ stepIndex }: { stepIndex: number }) {
  return (
    <ol className="mt-4 flex items-start">
      {STEPS.map((s, i) => {
        const done = i <= stepIndex;
        const current = i === stepIndex;
        return (
          <li key={s.label} className="relative flex flex-1 flex-col items-center gap-1.5">
            {i > 0 && (
              <span
                className="absolute top-3 right-1/2 left-[-50%] h-[2px]"
                style={{ background: done ? "var(--color-accent)" : "var(--color-line)" }}
                aria-hidden
              />
            )}
            <span
              className="num relative z-1 grid size-6 place-items-center rounded-full border-2 text-[11px] font-bold"
              style={{
                borderColor: done ? "var(--color-accent)" : "var(--color-line)",
                background: done ? "var(--color-accent)" : "var(--color-surface)",
                color: done ? "#FFFFFF" : "var(--color-ink-ghost)",
              }}
              aria-current={current ? "step" : undefined}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className="text-[11.5px] leading-tight"
              style={{
                color: current
                  ? "var(--color-ink)"
                  : done
                    ? "var(--color-ink-muted)"
                    : "var(--color-ink-ghost)",
                fontWeight: current ? 700 : 500,
              }}
            >
              {s.label}
            </span>
            <span className="text-center text-[10.5px] leading-tight text-ink-ghost">{s.note}</span>
          </li>
        );
      })}
    </ol>
  );
}
