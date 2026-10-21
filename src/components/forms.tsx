"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, cx } from "./ui";
import { useDialog } from "./dialog";
import { useToast } from "./toast";
import { ChevronDownIcon } from "./icons";

export type FormState = { ok?: boolean; error?: string; message?: string; warning?: string } | null;
export type FormAction = (prev: FormState, data: FormData) => Promise<FormState>;

export function SubmitButton({
  children,
  variant = "primary",
  className,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} loading={pending} className={className}>
      {children}
    </Button>
  );
}

/**
 * Form wired to a server action. Errors and warnings stay inline next to the fields;
 * a success is confirmed with a toast (and closes the surrounding dialog, if any).
 */
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
  const dialog = useDialog();
  const toast = useToast();
  useEffect(() => {
    if (!state?.ok) return;
    if (resetOnSuccess) ref.current?.reset();
    if (dialog) {
      dialog.close();
      toast(state.warning ? { tone: "warning", text: state.warning } : { text: state.message });
    } else {
      toast({ text: state.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form ref={ref} action={formAction} className={cx("space-y-4", className)}>
      {children}
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.warning && !dialog ? <Alert tone="warning">{state.warning}</Alert> : null}
    </form>
  );
}

/** Collapsible inline panel for secondary forms that read better in place than in a modal. */
export function Disclosure({ label, children, tone = "secondary" }: { label: string; children: ReactNode; tone?: "secondary" | "danger" }) {
  return (
    <details className="group no-print rounded-lg border border-border bg-surface open:shadow-xs">
      <summary
        className={cx(
          "flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors",
          tone === "danger" ? "text-danger hover:bg-danger-soft/60" : "text-text hover:bg-surface-2",
        )}
      >
        {label}
        <ChevronDownIcon className="size-4 text-muted transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-3.5 py-4">{children}</div>
    </details>
  );
}
