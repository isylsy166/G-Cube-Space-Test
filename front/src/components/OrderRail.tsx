"use client";

const STEPS = ["접수", "예약", "피킹", "출고"] as const;

/** 주문 진행 단계 레일. 지나온 단계는 채워지고, 지금 단계만 진하게 둔다. */
export function OrderRail({ stepIndex }: { stepIndex: number }) {
  return (
    <ol className="mt-4 flex items-center">
      {STEPS.map((label, i) => {
        const done = i <= stepIndex;
        const current = i === stepIndex;
        return (
          <li
            key={label}
            className="relative flex flex-1 flex-col items-center gap-1.5"
            style={{
              borderTop:
                i === 0 ? "none" : `1px solid ${done ? "var(--color-accent)" : "#E8E8EE"}`,
            }}
            aria-current={current ? "step" : undefined}
          >
            <span
              className="grid size-[22px] place-items-center rounded-full border font-mono text-[10.5px]"
              style={{
                borderColor: done ? "var(--color-accent)" : "#E0E0E8",
                background: done ? "var(--color-accent)" : "#FFFFFF",
                color: done ? "#FFFFFF" : "var(--color-ink-ghost)",
              }}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className="text-[10.5px]"
              style={{
                color: current
                  ? "var(--color-ink)"
                  : done
                    ? "#6B6B7B"
                    : "var(--color-ink-ghost)",
                fontWeight: current ? 600 : 400,
              }}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
