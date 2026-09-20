"use client";

export type FilterOption = {
  value: string;
  label: string;
  count?: number;
  warn?: boolean;
};

const toggleClass = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer";

/** 하나의 값만 선택하는 조회 조건. 선택 상태는 색과 테두리로 함께 표시한다. */
export function FilterRow({ label, options, value, onChange }: {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
      <span className="w-[64px] flex-none pt-2.5 text-xs font-semibold text-ink-muted">{label}</span>
      <div role="group" aria-label={label} className="flex max-w-full flex-wrap gap-1 rounded-xl border border-line bg-canvas p-1">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`${toggleClass} ${selected
                ? "border-[#202530] bg-[#202530] font-bold text-white shadow-sm"
                : "border-transparent text-ink-muted hover:bg-surface/70"}`}
            >
              <span className={option.warn && !selected ? "text-bad" : undefined}>{option.label}</span>
              {option.count !== undefined && (
                <span className={`num rounded-md px-1.5 py-0.5 text-[10px] ${selected ? "bg-white/15 text-white" : "bg-surface text-ink-faint"}`}>
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
