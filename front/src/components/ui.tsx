"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Tone } from "@/lib/tone";

/** 상태 배지. 점 + 라벨. 색은 tone.ts 의 한 쌍을 그대로 쓴다. */
export function Badge({
  tone,
  children,
  dot = true,
}: {
  tone: Tone;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-medium"
      style={{ color: tone[0], background: tone[1] }}
    >
      {dot && (
        <span
          className="size-[5px] shrink-0 rounded-full"
          style={{ background: tone[0] }}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

export function SectionTitle({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-baseline gap-2">
      <h3 className="text-[10.5px] font-semibold tracking-[0.06em] text-[--color-ink-ghost]">
        {children}
      </h3>
      {aside && <div className="ml-auto text-[10.5px] text-[#c0c0cc]">{aside}</div>}
    </div>
  );
}

export function Button({
  variant = "ghost",
  disabled,
  onClick,
  children,
  title,
}: {
  variant?: "primary" | "ghost";
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  title?: string;
}) {
  const primary = variant === "primary";
  const style: CSSProperties = disabled
    ? {
        border: "1px solid #ECECF2",
        background: primary ? "#FAFAFC" : "#FFFFFF",
        color: "#BEBECA",
      }
    : primary
      ? {
          border: "1px solid var(--color-accent)",
          background: "var(--color-accent)",
          color: "#FFFFFF",
          boxShadow: "0 1px 2px rgba(20,20,28,.12)",
        }
      : { border: "1px solid #DCDCE6", background: "#FFFFFF", color: "#3B3B4B" };

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className="inline-flex items-center rounded-[10px] px-4 py-[9px] text-xs font-medium transition-[filter] enabled:cursor-pointer enabled:hover:brightness-[.97] disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

/** 목록/상세를 좌우로 나누는 작업 화면 뼈대. 좁은 화면에서는 위아래로 쌓인다. */
export function SplitLayout({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  return (
    <div className="flex flex-1 flex-wrap items-stretch">
      <div className="min-w-0 flex-[1_1_580px] px-[26px] pt-[18px] pb-10">{list}</div>
      <aside className="box-border flex max-w-[452px] flex-[1_1_400px] flex-col border-l border-[--color-line] bg-[--color-surface]">
        {detail}
      </aside>
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="table-scroll rounded-[14px] border border-[--color-line] bg-[--color-surface] shadow-[0_1px_2px_rgba(20,20,28,.03)]">
      {children}
    </div>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <div className="p-[34px] text-center text-[12.5px] text-[--color-ink-dim]">{children}</div>
  );
}

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
      className="grid gap-2.5 border-b border-[#f1f1f5] bg-[#fcfcfd] px-[18px] py-[11px] text-[10.5px] font-semibold tracking-[0.05em] text-[--color-ink-ghost]"
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
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="grid cursor-pointer items-center gap-2.5 border-b border-[--color-line-soft] px-[18px] py-3 hover:bg-[#fafafc] focus:outline-none focus-visible:bg-[#f4f4fa]"
      style={{
        gridTemplateColumns: cols,
        minWidth,
        background: selected ? "#F7F7FB" : wash,
        boxShadow: selected ? "inset 3px 0 0 var(--color-accent)" : undefined,
      }}
    >
      {children}
    </div>
  );
}

/** 입고 진행률 막대. 다 찼으면 초록으로 끝난 걸 보여 준다. */
export function ProgressBar({ percent, height = 5 }: { percent: number; height?: number }) {
  return (
    <div
      className="overflow-hidden rounded-full bg-[#f1f1f5]"
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
}: {
  stats: { label: string; value: ReactNode; color?: string }[];
}) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-[11px] border border-[#f1f1f5] bg-[#fafafc] px-3 py-2.5"
        >
          <div className="text-[10px] text-[--color-ink-ghost]">{s.label}</div>
          <div
            className="mt-0.5 font-mono text-[18px] font-semibold"
            style={{ color: s.color ?? "var(--color-ink)" }}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2.5 text-[11px] leading-[1.7] text-pretty text-[--color-ink-dim]">
      {children}
    </p>
  );
}

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
  }[];
  empty: string;
}) {
  if (rows.length === 0)
    return <p className="text-xs text-[--color-ink-ghost]">{empty}</p>;
  return (
    <ul>
      {rows.map((l) => (
        <li
          key={l.key}
          className="flex items-baseline gap-2.5 border-b border-[--color-line-soft] py-1.5 text-[11.5px]"
        >
          <span className="w-11 shrink-0 text-[--color-ink-ghost]">{l.typeLabel}</span>
          <span className="w-8 shrink-0 font-mono font-semibold" style={{ color: l.color }}>
            {l.delta}
          </span>
          <span className="min-w-0 flex-1 text-[--color-ink-faint]">{l.memo}</span>
          {l.ref && <span className="font-mono text-[--color-ink-ghost]">{l.ref}</span>}
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
      className="grid flex-1 place-items-center p-8 text-center text-[12.5px] leading-[1.7]"
      style={{ color: tone === "error" ? "var(--color-bad)" : "var(--color-ink-dim)" }}
    >
      <p className="max-w-[300px]">{children}</p>
    </div>
  );
}

/** 목록 위에 붙는 현황 요약. 지금 걸러 본 범위가 어떤 상태인지 한 줄로 알려 준다. */
export function SummaryBanner({
  total,
  items,
  children,
}: {
  total: number;
  items: { label: string; value: number; color: string }[];
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[--color-line] bg-[--color-surface] px-4 py-2.5">
      <span className="text-xs text-[--color-ink-muted]">
        <strong className="font-mono text-sm font-semibold text-[--color-ink]">{total}</strong>
        건
      </span>
      <span className="h-3.5 w-px bg-[--color-line]" aria-hidden />
      {items.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5 text-xs">
          <span
            className="size-1.5 rounded-full"
            style={{ background: s.color }}
            aria-hidden
          />
          <span className="text-[--color-ink-muted]">{s.label}</span>
          <span className="font-mono text-xs font-semibold" style={{ color: s.color }}>
            {s.value}
          </span>
        </span>
      ))}
      {children && <div className="ml-auto">{children}</div>}
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
    <div className="flex items-center gap-2.5 border-b border-[--color-line] bg-[#f9f9fb] px-[18px] py-2">
      <span className="text-[12.5px] font-semibold">{title}</span>
      {meta && <span className="text-[11px] text-[--color-ink-dim]">{meta}</span>}
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
