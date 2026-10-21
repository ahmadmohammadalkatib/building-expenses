"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CloseIcon, DangerIcon, SuccessIcon, WarningIcon } from "./icons";
import { cx } from "./ui";

type Tone = "success" | "warning" | "danger";
type Item = { id: number; tone: Tone; text: string };
type Push = (t: { tone?: Tone; text?: string; duration?: number }) => void;

const ToastContext = createContext<Push>(() => {});

/** Transient confirmations ("Saved", "Created 12 charges") at the bottom inline-end corner. */
export function ToastProvider({ children, savedLabel, closeLabel }: { children: ReactNode; savedLabel: string; closeLabel: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const dismiss = useCallback((id: number) => setItems((s) => s.filter((i) => i.id !== id)), []);
  const push = useCallback<Push>(
    ({ tone = "success", text, duration = 5000 }) => {
      const id = Date.now() + Math.random();
      setItems((s) => [...s.slice(-2), { id, tone, text: text || savedLabel }]);
      setTimeout(() => dismiss(id), duration);
    },
    [savedLabel, dismiss],
  );
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {items.map((i) => {
          const Icon = i.tone === "success" ? SuccessIcon : i.tone === "warning" ? WarningIcon : DangerIcon;
          return (
            <div
              key={i.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm animate-rise items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-lg"
            >
              <Icon
                className={cx(
                  "mt-0.5 size-4 shrink-0",
                  i.tone === "success" ? "text-success" : i.tone === "warning" ? "text-warning" : "text-danger",
                )}
                aria-hidden
              />
              <p className="min-w-0 flex-1 text-text">{i.text}</p>
              <button
                type="button"
                onClick={() => dismiss(i.id)}
                aria-label={closeLabel}
                className="-m-1 rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <CloseIcon className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
