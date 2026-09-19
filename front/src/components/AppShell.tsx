"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { useItems, useOrders, useSchedules } from "@/lib/hooks";
import { READINESS_TONE } from "@/lib/tone";
import type { ReadinessStatus } from "@/lib/types";
import { BASE_TIME_LABEL } from "@/lib/basetime";

const NAV = [
  {
    href: "/orders",
    label: "주문",
    icon: (
      <path d="M3.5 2.5h9v11l-2-1.3-2 1.3-2-1.3-2 1.3zM6 6h4M6 8.6h4" />
    ),
  },
  {
    href: "/items",
    label: "제품",
    icon: <path d="M8 2.2 13.4 5 8 7.8 2.6 5zM2.6 5v6l5.4 2.8 5.4-2.8V5M8 7.8v6" />,
  },
  {
    href: "/schedules",
    label: "발주",
    icon: <path d="M8 2.4v6.4M5.4 6.4 8 9l2.6-2.6M2.6 10.4v2.2h10.8v-2.2" />,
  },
] as const;

/** 사이드바에서 한 번에 눌러 거를 수 있는 준비 상태 묶음. */
const KPIS: { label: string; match: ReadinessStatus[]; param: string }[] = [
  { label: "바로 준비 가능", match: ["READY"], param: "READY" },
  {
    label: "입고 대기",
    match: ["WAIT_INSPECTION", "WAIT_PRODUCTION", "WAIT_PURCHASE"],
    param: "WAITING",
  },
  { label: "재고 부족", match: ["SHORTAGE"], param: "SHORTAGE" },
  { label: "확인 필요", match: ["REVIEW_REQUIRED"], param: "REVIEW_REQUIRED" },
];

const PAGE_META: Record<
  string,
  { crumb: string; title: string; desc: string; placeholder: string }
> = {
  "/orders": {
    crumb: "운영 · 주문",
    title: "주문 준비 현황",
    desc: "배송일이 빠른 주문부터 재고를 가져갑니다. 막힌 주문이 무엇을 기다리는지 보고 예약·피킹·출고를 진행하세요.",
    placeholder: "주문번호 · 창고 검색",
  },
  "/items": {
    crumb: "운영 · 제품",
    title: "제품 재고",
    desc: "가용재고 = 현재고 − 예약수량. 사용 중지된 창고의 재고와 입고예정은 준비 판단에서 빠집니다.",
    placeholder: "품목코드 · 품목명 검색",
  },
  "/schedules": {
    crumb: "운영 · 발주",
    title: "발주 · 생산의뢰",
    desc: "발주만으로는 현재고가 늘지 않습니다. 입고 처리를 해야 재고가 늘고, 그 재고를 기다리던 주문이 다시 판정됩니다.",
    placeholder: "문서번호 · 품목 검색",
  },
};

function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeKpi = searchParams.get("readiness") ?? "";

  const { data: orders } = useOrders();
  const { data: items } = useItems();
  const { data: schedules } = useSchedules();

  const counts = useMemo(() => {
    const list = orders ?? [];
    return KPIS.map((k) => ({
      ...k,
      value: list.filter(
        (o) => o.readinessStatus && k.match.includes(o.readinessStatus),
      ).length,
    }));
  }, [orders]);

  const navCounts: Record<string, number | undefined> = {
    "/orders": orders?.length,
    "/items": items?.length,
    // 발주 탭은 아직 받을 게 남은 문서 수를 센다.
    "/schedules": schedules?.filter((s) => s.remainingQuantity > 0).length,
  };

  return (
    <nav className="sticky top-0 flex h-screen w-[236px] flex-none flex-col gap-[22px] self-start border-r border-[--color-line] bg-[--color-surface] px-3.5 pt-5 pb-4">
      <div className="flex items-center gap-2.5 px-1.5">
        <div className="grid size-7 flex-none place-items-center rounded-lg bg-[--color-accent] font-mono text-[13px] font-semibold text-white">
          F
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-[13.5px] font-semibold tracking-[-0.01em]">Flowstock</span>
          <span className="text-[10.5px] text-[#9c9cab]">재고 운영 콘솔</span>
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <h2 className="px-2 pb-1.5 text-[10px] font-semibold tracking-[0.08em] text-[--color-ink-ghost]">
          WORKSPACE
        </h2>
        {NAV.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-[13px] transition-colors"
              style={{
                fontWeight: active ? 600 : 400,
                color: active ? "#FFFFFF" : "var(--color-ink-muted)",
                background: active ? "var(--color-accent)" : "transparent",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-none opacity-85"
                aria-hidden
              >
                {n.icon}
              </svg>
              <span className="flex-1">{n.label}</span>
              <span
                className="font-mono text-[11px]"
                style={{ color: active ? "rgba(255,255,255,.78)" : "var(--color-ink-ghost)" }}
              >
                {navCounts[n.href] ?? ""}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-0.5">
        <h2 className="px-2 pb-2 text-[10px] font-semibold tracking-[0.08em] text-[--color-ink-ghost]">
          오늘의 준비 현황
        </h2>
        {counts.map((k) => {
          const on = pathname === "/orders" && activeKpi === k.param;
          const dot = READINESS_TONE[k.match[0]][0];
          return (
            <Link
              key={k.param}
              // 같은 묶음을 다시 누르면 필터를 푼다.
              href={on ? "/orders" : `/orders?readiness=${k.param}`}
              className="flex items-center gap-2.5 rounded-[9px] px-2.5 py-[7px] text-xs"
              style={{ background: on ? "#F4F4F9" : "transparent" }}
            >
              <span
                className="size-1.5 flex-none rounded-full"
                style={{ background: dot }}
                aria-hidden
              />
              <span className="flex-1 text-[--color-ink-muted]">{k.label}</span>
              <span className="font-mono text-xs font-semibold" style={{ color: dot }}>
                {orders ? k.value : "–"}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto px-1 text-[10.5px] leading-[1.6] text-[#a8a8b6]">
        <span className="block">업무 기준시각</span>
        <span className="font-mono text-[11px] text-[#6b6b7b]">{BASE_TIME_LABEL}</span>
        <span className="mt-1 block">배송까지 남은 일수는 이 시각 기준입니다.</span>
      </div>
    </nav>
  );
}

function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const meta = PAGE_META[pathname];
  if (!meta) return null;

  const q = searchParams.get("q") ?? "";

  // 검색어를 URL 에 두면 필터가 걸린 화면을 그대로 공유할 수 있다.
  const setQ = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set("q", value);
    else next.delete("q");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-end gap-[18px] border-b border-[--color-line] bg-[rgba(246,246,249,.92)] px-[26px] pt-[18px] pb-3.5 backdrop-blur-lg">
      <div className="min-w-0">
        <p className="mb-[3px] text-[11px] tracking-[0.03em] text-[--color-ink-dim]">
          {meta.crumb}
        </p>
        <h1 className="text-xl leading-tight font-bold tracking-[-0.02em]">{meta.title}</h1>
        <p className="mt-[5px] max-w-[720px] text-[12.5px] text-pretty text-[#7c7c8c]">
          {meta.desc}
        </p>
      </div>
      <div className="ml-auto flex min-w-[212px] items-center gap-[7px] rounded-[9px] border border-[#e8e8ee] bg-[--color-surface] px-[11px] py-[7px]">
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="#A8A8B6"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="flex-none"
          aria-hidden
        >
          <circle cx="7" cy="7" r="4.2" />
          <path d="M10.2 10.2 13.5 13.5" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={meta.placeholder}
          aria-label={meta.placeholder}
          className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-[--color-ink-ghost]"
        />
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-stretch bg-[--color-canvas]">
      <Suspense fallback={<div className="w-[236px] flex-none border-r border-[--color-line] bg-[--color-surface]" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={null}>
          <Header />
        </Suspense>
        {children}
      </div>
    </div>
  );
}
