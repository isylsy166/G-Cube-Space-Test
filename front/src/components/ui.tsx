"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Tone } from "@/lib/tone";

/* ── 배지 ─────────────────────────────────────────────────────────── */

/** 상태 배지. 테두리까지 색을 주어 옅은 배경에서도 형태가 남는다. */
export function Badge({
  tone,
  children,
  dot = true,
  strong = false,
}: {
  tone: Tone;
  children: ReactNode;
  dot?: boolean;
  /** 지금 가장 중요한 배지 하나를 키울 때 */
  strong?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border whitespace-nowrap ${
        strong ? "px-3 py-1 text-[13px] font-semibold" : "px-2.5 py-[3px] text-xs font-medium"
      }`}
      style={{ color: tone[0], background: tone[1], borderColor: tone[2] }}
    >
      {dot && (
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: tone[0] }}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

/* ── 버튼 ─────────────────────────────────────────────────────────── */

export function Button({
  variant = "default",
  size = "md",
  disabled,
  onClick,
  children,
  title,
}: {
  variant?: "primary" | "default" | "subtle";
  size?: "sm" | "md";
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  title?: string;
}) {
  const style: CSSProperties = disabled
    ? { border: "1px solid var(--color-line)", background: "#F7F8FA", color: "#AEB4C0" }
    : variant === "primary"
      ? {
          border: "1px solid var(--color-accent)",
          background: "var(--color-accent)",
          color: "#FFFFFF",
          boxShadow: "0 1px 2px rgba(17,19,28,.14)",
        }
      : variant === "subtle"
        ? { border: "1px solid transparent", background: "var(--color-accent-soft)", color: "var(--color-accent-ink)" }
        : { border: "1px solid #D4D8E2", background: "#FFFFFF", color: "var(--color-ink-soft)" };

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={`inline-flex items-center justify-center gap-1.5 rounded-[9px] font-semibold whitespace-nowrap transition-[filter,background] enabled:cursor-pointer enabled:hover:brightness-[.96] disabled:cursor-not-allowed ${
        size === "sm" ? "px-3 py-[6px] text-xs" : "px-4 py-[9px] text-[13px]"
      }`}
    >
      {children}
    </button>
  );
}

/* ── 레이아웃 ─────────────────────────────────────────────────────── */

/** 목록/상세를 좌우로 나누는 작업 화면 뼈대. 좁은 화면에서는 위아래로 쌓인다. */
export function SplitLayout({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  return (
    <div className="flex flex-1 flex-wrap items-stretch">
      <div className="min-w-0 flex-[1_1_560px] px-6 pt-5 pb-12">{list}</div>
      <aside className="box-border min-w-0 flex w-full flex-[1_1_420px] xl:max-w-[480px] flex-col self-start border-l border-line bg-surface xl:sticky xl:top-[116px] xl:max-h-[calc(100vh-132px)] xl:overflow-y-auto">
        {detail}
      </aside>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(17,19,28,.04)] ${className}`}
    >
      {children}
    </div>
  );
}

/** 카드 머리. 제목과 한 줄 설명을 같은 규칙으로 붙인다. */
export function CardHeader({
  title,
  desc,
  right,
}: {
  title: ReactNode;
  desc?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-raised px-4 py-3">
      <h3 className="text-[14px] font-bold tracking-[-0.01em]">{title}</h3>
      {desc && <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-faint">{desc}</p>}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <h3 className="text-[13px] font-bold tracking-[-0.01em] text-ink-soft">{children}</h3>
      {aside && <div className="ml-auto text-[11px] font-medium text-ink-dim">{aside}</div>}
    </div>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <div className="p-10 text-center text-[13px] text-ink-dim">{children}</div>;
}

/* ── 표 ───────────────────────────────────────────────────────────── */

/** 표 헤더/본문이 같은 grid 를 쓰도록 컬럼 정의를 공유한다. */
export function TableHead({
  cols,
  minWidth,
  children,
}: {
  cols: string;
  minWidth: number;
  children: ReactNode;
}) {
  return (
    <div
      className="sticky-head grid items-end gap-3 border-b border-line bg-raised px-4 py-2.5 text-[11px] font-bold tracking-[0.02em] text-ink-faint"
      style={{ gridTemplateColumns: cols, minWidth }}
    >
      {children}
    </div>
  );
}

export function TableRow({
  cols,
  minWidth,
  selected,
  onSelect,
  children,
  wash,
}: {
  cols: string;
  minWidth: number;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
  /** 준비가 막힌 줄처럼 목록에서 먼저 눈에 띄어야 할 때의 배경색 */
  wash?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="grid cursor-pointer items-center gap-3 border-b border-line-soft px-4 py-3 transition-colors hover:bg-[#f6f7fa]"
      style={{
        gridTemplateColumns: cols,
        minWidth,
        background: selected ? "var(--color-accent-soft)" : wash,
        boxShadow: selected ? "inset 3px 0 0 var(--color-accent)" : undefined,
      }}
    >
      {children}
    </div>
  );
}

/** 배송일처럼 목록을 끊어 주는 머리글. */
export function GroupHeader({
  title,
  meta,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-y border-line bg-[#f1f3f7] px-4 py-2">
      <span className="text-[13px] font-bold tracking-[-0.01em]">{title}</span>
      {meta && <span className="text-xs font-medium text-ink-faint">{meta}</span>}
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}

/* ── 수치 표시 ────────────────────────────────────────────────────── */

/** 입고 진행률 막대. 다 찼으면 초록으로 끝난 걸 보여 준다. */
export function ProgressBar({ percent, height = 6 }: { percent: number; height?: number }) {
  return (
    <div
      className="overflow-hidden rounded-full bg-[#e8eaf0]"
      style={{ height }}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${percent}%`,
          background: percent >= 100 ? "var(--color-good)" : "var(--color-accent)",
        }}
      />
    </div>
  );
}

export function StatGrid({
  stats,
  columns = 3,
}: {
  stats: { label: string; value: ReactNode; color?: string; hint?: string }[];
  columns?: number;
}) {
  return (
    <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}>
      {stats.map((s) => (
        <div key={s.label} className="rounded-[10px] border border-line bg-raised px-3 py-2.5">
          <div className="text-[11px] font-semibold text-ink-faint">{s.label}</div>
          <div
            className="num mt-0.5 text-[20px] leading-tight font-bold"
            style={{ color: s.color ?? "var(--color-ink)" }}
          >
            {s.value}
          </div>
          {s.hint && <div className="mt-0.5 text-[10.5px] text-ink-ghost">{s.hint}</div>}
        </div>
      ))}
    </div>
  );
}

/**
 * 가용재고 계산식. "현재고 − 예약 = 가용" 을 화면에서 그대로 읽히게 둔다.
 * 숫자만 나열하면 어느 값이 판단 기준인지 매번 되짚어야 한다.
 */
export function AvailableFormula({
  quantity,
  booked,
  available,
  className = "",
}: {
  quantity: number;
  booked: number;
  available: number;
  className?: string;
}) {
  const tone = available > 0 ? "var(--color-good)" : "var(--color-bad)";
  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[10px] border border-line bg-raised px-3 py-2 ${className}`}
    >
      <Term label="현재고" value={quantity} />
      <Op>−</Op>
      <Term label="예약" value={booked} />
      <Op>=</Op>
      <span className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-semibold" style={{ color: tone }}>
          가용
        </span>
        <span className="num text-[17px] font-bold" style={{ color: tone }}>
          {available}
        </span>
      </span>
      <span className="ml-auto text-[11px] text-ink-dim">지금 쓸 수 있는 수량</span>
    </div>
  );
}

function Term({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[11px] font-semibold text-ink-faint">{label}</span>
      <span className="num text-[15px] font-semibold text-ink-soft">{value}</span>
    </span>
  );
}

function Op({ children }: { children: ReactNode }) {
  return <span className="num text-[15px] text-ink-ghost">{children}</span>;
}

/* ── 안내 ─────────────────────────────────────────────────────────── */

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-xs leading-relaxed text-pretty text-ink-faint">{children}</p>;
}

/** 색으로 성격을 알리는 안내 상자. 제목 한 줄 + 본문. */
export function Callout({
  tone,
  title,
  children,
}: {
  tone: Tone;
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-[11px] border px-3.5 py-3 text-[13px] leading-relaxed"
      style={{ color: tone[0], background: tone[1], borderColor: tone[2] }}
    >
      {title && <p className="mb-1 font-bold">{title}</p>}
      <div className="text-pretty">{children}</div>
    </div>
  );
}

/* ── 이력 ─────────────────────────────────────────────────────────── */

export function LedgerList({
  rows,
  empty,
}: {
  rows: {
    key: string;
    typeLabel: string;
    delta: string;
    color: string;
    memo: string;
    ref?: string;
    at?: string;
  }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-xs text-ink-dim">{empty}</p>;
  return (
    <ul className="overflow-hidden rounded-[10px] border border-line">
      {rows.map((l, i) => (
        <li
          key={l.key}
          className="flex items-baseline gap-2.5 px-3 py-2 text-xs"
          style={{
            background: i % 2 ? "var(--color-raised)" : "var(--color-surface)",
            borderTop: i ? "1px solid var(--color-line-soft)" : undefined,
          }}
        >
          <span className="w-11 shrink-0 font-semibold text-ink-faint">{l.typeLabel}</span>
          <span className="num w-9 shrink-0 text-right font-bold" style={{ color: l.color }}>
            {l.delta}
          </span>
          <span className="min-w-0 flex-1 text-ink-muted">{l.memo}</span>
          {l.ref && <span className="num shrink-0 text-ink-dim">{l.ref}</span>}
          {l.at && <span className="num shrink-0 text-[10.5px] text-ink-ghost">{l.at}</span>}
        </li>
      ))}
    </ul>
  );
}

/** 상세 패널이 비었거나 불러오는 중일 때 자리를 지키는 안내. */
export function PanelMessage({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <div
      className="grid flex-1 place-items-center p-8 text-center text-[13px] leading-relaxed"
      style={{ color: tone === "error" ? "var(--color-bad)" : "var(--color-ink-dim)" }}
    >
      <p className="max-w-[320px]">{children}</p>
    </div>
  );
}

/* ── 요약 / 탭 ────────────────────────────────────────────────────── */

/** 목록 위에 붙는 현황 요약. 누르면 그 상태만 걸러 본다. */
export function SummaryBanner({
  total,
  totalLabel = "건",
  items,
  active,
  onPick,
  children,
}: {
  total: number;
  totalLabel?: string;
  items: { key?: string; label: string; value: number; color: string }[];
  active?: string;
  onPick?: (key: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border border-line bg-surface px-3 py-2.5">
      <span className="flex items-baseline gap-1 pr-1 text-xs text-ink-faint">
        <strong className="num text-[17px] font-bold text-ink">{total}</strong>
        {totalLabel}
      </span>
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      {items.map((s) => {
        const key = s.key ?? s.label;
        const on = active !== undefined && active === key;
        const clickable = Boolean(onPick && s.key !== undefined);
        const Tag = clickable ? "button" : "div";
        return (
          <Tag
            key={key}
            {...(clickable
              ? {
                  type: "button" as const,
                  "aria-pressed": on,
                  onClick: () => onPick?.(on ? "" : key),
                  className:
                    "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors",
                }
              : {
                  className: "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs",
                })}
            style={{
              borderColor: on ? s.color : "transparent",
              background: on ? `${s.color}12` : "transparent",
            }}
          >
            <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
            <span className="font-medium text-ink-muted">{s.label}</span>
            <span className="num font-bold" style={{ color: s.color }}>
              {s.value}
            </span>
          </Tag>
        );
      })}
      {children && <div className="ml-auto">{children}</div>}
    </div>
  );
}

/** 같은 데이터를 다른 질문으로 보는 탭. 라벨에 질문을 그대로 적는다. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; hint?: string; count?: number; color?: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div role="tablist" className="mb-3 flex flex-wrap gap-1.5">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={`flex cursor-pointer items-center gap-2 rounded-[10px] border px-3.5 py-2 text-[13px] transition-colors ${
              on ? "font-bold" : "font-medium"
            }`}
            style={{
              borderColor: on ? "var(--color-accent)" : "var(--color-line)",
              background: on ? "var(--color-accent)" : "var(--color-surface)",
              color: on ? "#FFFFFF" : "var(--color-ink-muted)",
            }}
          >
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span
                className="num rounded-full px-1.5 py-[1px] text-[11px] font-bold"
                style={{
                  background: on ? "rgba(255,255,255,.2)" : (t.color ?? "var(--color-neutral)") + "1A",
                  color: on ? "#FFFFFF" : (t.color ?? "var(--color-ink-faint)"),
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
