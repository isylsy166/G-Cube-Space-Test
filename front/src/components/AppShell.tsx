"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BASE_TIME_LABEL } from "@/lib/basetime";

const NAV = [
  {
    href: "/orders",
    label: "주문",
    sub: "배송 준비 및 출고",
    icon: <path d="M3.5 2.5h9v11l-2-1.3-2 1.3-2-1.3-2 1.3zM6 6h4M6 8.6h4" />,
  },
  {
    href: "/items",
    label: "제품",
    sub: "재고 수량 및 보관 위치",
    icon: <path d="M8 2.2 13.4 5 8 7.8 2.6 5zM2.6 5v6l5.4 2.8 5.4-2.8V5M8 7.8v6" />,
  },
  {
    href: "/schedules",
    label: "발주",
    sub: "구매·생산 및 입고 관리",
    icon: <path d="M8 2.4v6.4M5.4 6.4 8 9l2.6-2.6M2.6 10.4v2.2h10.8v-2.2" />,
  },
] as const;

const PAGE_META: Record<string, { crumb: string; title: string; desc: string; placeholder: string }> =
  {
    "/orders": {
      crumb: "운영 · 주문",
      title: "주문 준비 현황",
      desc: "배송일 순으로 준비 상태를 확인하고, 재고 예약부터 출고까지 진행하세요.",
      placeholder: "주문번호 · 창고 검색",
    },
    "/items": {
      crumb: "운영 · 제품",
      title: "제품 재고",
      desc: "창고별 사용 가능한 재고와 예약 수량, 제품의 보관 위치를 확인하세요.",
      placeholder: "품목코드 · 품목명 검색",
    },
    "/schedules": {
      crumb: "운영 · 발주",
      title: "발주 · 생산의뢰",
      desc: "구매발주와 생산의뢰의 진행 상황을 확인하고, 도착한 품목을 입고 처리하세요.",
      placeholder: "문서번호 · 품목 검색",
    },
  };

function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 flex h-screen w-[208px] flex-none flex-col gap-6 self-start border-r border-line bg-surface px-3.5 pt-5 pb-4">
      <div className="flex items-center gap-2.5 px-1.5">
        <div className="num grid size-8 flex-none place-items-center rounded-[10px] bg-accent text-sm font-bold text-white">
          F
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-[14px] font-bold tracking-[-0.01em]">Flowstock</span>
          <span className="text-[11px] text-ink-dim">주문·재고 관리</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {NAV.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors hover:bg-[#f4f5f8]"
              style={{
                color: active ? "#FFFFFF" : "var(--color-ink-muted)",
                background: active ? "var(--color-accent)" : "transparent",
              }}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-none"
                aria-hidden
              >
                {n.icon}
              </svg>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13.5px]" style={{ fontWeight: active ? 700 : 500 }}>
                  {n.label}
                </span>
                <span
                  className="truncate text-[10.5px]"
                  style={{ color: active ? "rgba(255,255,255,.72)" : "var(--color-ink-ghost)" }}
                >
                  {n.sub}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto rounded-[10px] bg-raised px-3 py-2.5 text-[11px] leading-relaxed text-ink-dim">
        <span className="block font-semibold text-ink-faint">업무 기준시각</span>
        <span className="num block text-xs text-ink-muted">{BASE_TIME_LABEL}</span>
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
    <header className="sticky top-0 z-30 flex flex-wrap items-end gap-4 border-b border-line bg-[rgba(244,245,248,.92)] px-6 pt-5 pb-4 backdrop-blur-lg">
      <div className="min-w-0">
        <p className="mb-1 text-[11px] font-semibold tracking-[0.04em] text-ink-dim">{meta.crumb}</p>
        <h1 className="text-[22px] leading-tight font-bold tracking-[-0.02em]">{meta.title}</h1>
        <p className="mt-1.5 max-w-[760px] text-[13px] leading-relaxed text-pretty text-ink-faint">
          {meta.desc}
        </p>
      </div>
      <label className="ml-auto flex min-w-[232px] items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2 focus-within:border-accent">
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="var(--color-ink-dim)"
          strokeWidth="1.6"
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
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-ghost"
        />
      </label>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-stretch bg-canvas">
      <Suspense
        fallback={<div className="w-[208px] flex-none border-r border-line bg-surface" />}
      >
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
