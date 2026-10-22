"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CloseIcon } from "./icons";
import { Button, cx, type Variant } from "./ui";

const DialogContext = createContext<{ close: () => void } | null>(null);

/** Inside a Dialog: lets forms close it after a successful save. */
export function useDialog() {
  return useContext(DialogContext);
}

/**
 * Modal built on native <dialog>: focus trapping, Escape and top-layer stacking come from the browser.
 * The body is mounted fresh on every open, so forms inside start clean each time.
 */
export function Dialog({
  label,
  icon,
  variant = "secondary",
  size = "md",
  title,
  description,
  closeLabel,
  tone,
  defaultOpen,
  children,
}: {
  label: ReactNode;
  icon?: ReactNode;
  variant?: Variant;
  size?: "sm" | "md";
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  tone?: "danger";
  /** Open on first render (e.g. a link with ?edit=1) */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(!!defaultOpen);
  const [generation, setGeneration] = useState(0);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => {
          setGeneration((g) => g + 1);
          setOpen(true);
        }}
        aria-haspopup="dialog"
      >
        {icon}
        {label}
      </Button>
      <dialog
        ref={ref}
        className="modal w-[calc(100%-2rem)] max-w-lg"
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false); // backdrop click
        }}
      >
        <div className="modal-panel overflow-hidden rounded-2xl border border-border bg-surface text-start shadow-lg">
          <div className={cx("flex items-start justify-between gap-4 border-b border-border px-5 py-4", tone === "danger" && "bg-danger-soft/40")}>
            <div className="min-w-0">
              <h2 id={titleId} className={cx("text-base font-semibold", tone === "danger" && "text-danger")}>
                {title}
              </h2>
              {description ? <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={closeLabel}
              className="-m-1.5 shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
          <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto px-5 py-5">
            <DialogContext.Provider value={{ close: () => setOpen(false) }}>
              {open ? <div key={generation}>{children}</div> : null}
            </DialogContext.Provider>
          </div>
        </div>
      </dialog>
    </>
  );
}
