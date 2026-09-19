"use client";

export type FilterOption = {
  value: string;
  label: string;
  /** 칩에 함께 보여 줄 건수. 0 이어도 표시해 "없음"을 알 수 있게 한다. */
  count?: number;
  /** 사용 중지된 창고처럼 주의가 필요한 선택지 */
  warn?: boolean;
};

/** 칩 한 줄. 라벨 + 선택지들. 여러 줄을 쌓으면 필터 바가 된다. */
export function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 flex-none text-[11px] text-[--color-ink-dim]">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
      >
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value || "all"}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className="cursor-pointer rounded-full border px-3 py-1 text-xs whitespace-nowrap transition-colors"
              style={{
                borderColor: on
                  ? "var(--color-accent)"
                  : o.warn
                    ? "#F0D8CC"
                    : "#E4E4EC",
                background: on ? "var(--color-accent)" : "#FFFFFF",
                color: on ? "#FFFFFF" : o.warn ? "var(--color-bad)" : "var(--color-ink-muted)",
              }}
            >
              {o.label}
              {o.count !== undefined && (
                <span
                  className="ml-1.5 font-mono text-[10.5px]"
                  style={{ color: on ? "rgba(255,255,255,.75)" : "var(--color-ink-ghost)" }}
                >
                  {o.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
