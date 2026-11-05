/** Messages éphémères en bas d'écran. */
import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

interface ToastApi {
  toast: (message: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<number | null>(null);
  const toast = useCallback((text: string) => {
    setMessage({ id: Date.now(), text });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 2600);
  }, []);
  const api = useMemo(() => ({ toast }), [toast]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className="no-print pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4"
        aria-live="polite"
      >
        <AnimatePresence>
          {message ? (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
              className="bg-ink shadow-raised max-w-full rounded-[12px] px-4 py-[11px] text-[13px] font-semibold text-white"
            >
              {message.text}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): (message: string) => void {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast doit être utilisé sous <ToastProvider>");
  return ctx.toast;
}
