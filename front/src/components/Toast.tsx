"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Toast = { message: string; ok: boolean; id: number };

const ToastContext = createContext<(message: string, ok: boolean) => void>(() => {});

/** 명령 결과를 알리는 토스트. 서버가 내려준 한글 사유를 그대로 띄운다. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback((message: string, ok: boolean) => {
    setToast({ message, ok, id: Date.now() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4600);
  }, []);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[26px] left-1/2 z-80 flex max-w-[660px] -translate-x-1/2 items-center gap-2.5 rounded-xl bg-[#16161f] px-[18px] py-3 text-[12.5px] leading-normal text-[#f5f5f8] shadow-[0_18px_40px_-16px_rgba(20,20,28,.55)]"
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: toast.ok ? "#5BD1A6" : "#F0906B" }}
            aria-hidden
          />
          <span>{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
