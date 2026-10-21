"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, cx } from "./ui";

export type FormState = { ok?: boolean; error?: string; message?: string; warning?: string } | null;
export type FormAction = (prev: FormState, data: FormData) => Promise<FormState>;

export function SubmitButton({ children, variant = "primary", className }: { children: ReactNode; variant?: "primary" | "secondary" | "danger"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className} aria-busy={pending}>
      {pending ? "…" : children}
    </Button>
  );
}

/** Form wired to a server action; shows the result inline. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={cx("space-y-4", className)}>
      {children}
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.warning ? <Alert tone="warning">{state.warning}</Alert> : null}
      {state?.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
    </form>
  );
}

/** Small inline disclosure for secondary forms (void, adjust, edit). */
export function Disclosure({ label, children, tone = "secondary" }: { label: string; children: ReactNode; tone?: "secondary" | "danger" }) {
  return (
    <details className="group no-print">
      <summary
        className={cx(
          "inline-flex cursor-pointer list-none items-center rounded-lg px-3 py-1.5 text-sm font-medium",
          tone === "danger" ? "text-danger hover:bg-danger-soft" : "text-primary hover:bg-primary-soft",
        )}
      >
        {label}
      </summary>
      <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">{children}</div>
    </details>
  );
}
