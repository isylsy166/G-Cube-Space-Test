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
          className="fixed bottom-7 left-1/2 z-80 flex max-w-[680px] -translate-x-1/2 items-start gap-2.5 rounded-xl bg-[#14161f] px-4 py-3 text-[13px] leading-relaxed text-[#f2f3f7] shadow-[0_20px_44px_-18px_rgba(17,19,28,.6)]"
        >
          <span
            className="mt-[6px] size-2 shrink-0 rounded-full"
            style={{ background: toast.ok ? "#4FD2A8" : "#F58A63" }}
            aria-hidden
          />
          <span className="text-pretty">{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
