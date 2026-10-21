import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowLeftIcon, DangerIcon, InboxIcon, InfoIcon, SearchIcon, SpinnerIcon, SuccessIcon, WarningIcon } from "./icons";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Avatar initials: two letters for Latin names, the first letter otherwise (Arabic letters don't pair well). */
export function initials(name: string) {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  const first = parts[0] ?? "?";
  if (!/^[A-Za-z]/.test(first)) return first.charAt(0);
  return (parts.length > 1 ? first[0] + parts[1][0] : first.slice(0, 2)).toUpperCase();
}

/** Inline entity link (apartment numbers, receipts, months) */
export const LINK = "font-medium text-primary underline-offset-4 hover:underline";

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6 sm:mb-8">
      {back ? (
        <Link
          href={back.href}
          className="no-print mb-3 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
        >
          <ArrowLeftIcon className="size-4 rtl:rotate-180" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">{title}</h1>
          {subtitle ? <div className="mt-1.5 text-sm text-muted">{subtitle}</div> : null}
        </div>
        {actions ? <div className="no-print flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  flush,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Edge-to-edge content (tables, lists): header gets a divider instead of padding around everything */
  flush?: boolean;
}) {
  const head =
    title || actions ? (
      <div
        className={cx(
          "flex flex-wrap items-center justify-between gap-x-3 gap-y-2",
          flush ? "border-b border-border px-4 py-3.5 sm:px-5" : "mb-4",
        )}
      >
        <div className="min-w-0">
          {title ? <h2 className="text-[0.9375rem] font-semibold">{title}</h2> : null}
          {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="no-print flex items-center gap-2">{actions}</div> : null}
      </div>
    ) : null;
  return (
    <section
      className={cx(
        "print-plain rounded-xl border border-border bg-surface shadow-xs",
        flush ? "overflow-hidden" : "p-4 sm:p-5",
        className,
      )}
    >
      {head}
      {children}
    </section>
  );
}

/** Settings-style block: title + explanation beside the fields on wide screens */
export function FormSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-4 py-6 first:pt-0 last:pb-0 lg:grid-cols-3 lg:gap-8">
      <div>
        <h2 className="text-[0.9375rem] font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      <div className="print-plain rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5 lg:col-span-2">{children}</div>
    </section>
  );
}

export type Variant = "primary" | "secondary" | "danger" | "dangerSoft" | "ghost" | "accent";
type Size = "sm" | "md";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-ink shadow-xs hover:bg-primary-hover",
  secondary: "border border-border-strong bg-surface text-text shadow-xs hover:bg-surface-2",
  danger: "bg-danger-solid text-white shadow-xs hover:brightness-110",
  dangerSoft: "text-danger hover:bg-danger-soft",
  ghost: "text-text-2 hover:bg-surface-2 hover:text-text",
  accent: "text-primary hover:bg-primary-soft",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-2.5 text-[0.8125rem] [&_svg]:size-3.5",
  md: "h-9 gap-2 rounded-lg px-3.5 text-sm [&_svg]:size-4",
};
const BTN =
  "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-55 [&_svg]:shrink-0";

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cx(BTN, VARIANTS[variant], SIZES[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...p
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      className={buttonClass(variant, size, cx(loading && "[&>svg:not(.animate-spin)]:hidden", className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...p}
    >
      {loading ? <SpinnerIcon className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...p} />;
}

const INPUT =
  "w-full min-w-0 rounded-lg border border-border-strong bg-surface px-3 text-sm text-text shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted/70 hover:border-muted/50 focus:border-primary focus:ring-3 focus:ring-primary/15 aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted disabled:shadow-none";

export function Input({ className, type, ...p }: ComponentProps<"input">) {
  const file = type === "file";
  return (
    <input
      type={type}
      className={cx(
        INPUT,
        file
          ? "py-1.5 text-muted file:me-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-sm file:font-medium file:text-text hover:file:bg-surface-3"
          : "h-9",
        className,
      )}
      {...p}
    />
  );
}
export function SearchInput({ className, ...p }: ComponentProps<"input">) {
  return (
    <div className={cx("relative", className)}>
      <SearchIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted" aria-hidden />
      <input type="search" className={cx(INPUT, "h-9 ps-9")} {...p} />
    </div>
  );
}
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cx(INPUT, "select-chevron h-9 cursor-pointer pe-9", className)} {...p} />;
}
export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cx(INPUT, "min-h-20 py-2 leading-relaxed", className)} {...p} />;
}

export function Field({ label, help, children, className }: { label: string; help?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block min-w-0", className)}>
      <span className="mb-1.5 block text-[0.8125rem] font-medium text-text-2">{label}</span>
      {children}
      {help ? <span className="mt-1.5 block text-xs leading-relaxed text-muted">{help}</span> : null}
    </label>
  );
}

export function Checkbox({ label, className, ...p }: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return (
    <label className={cx("inline-flex cursor-pointer items-start gap-2.5 text-sm text-text-2", className)}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-border-strong" {...p} />
      <span>{label}</span>
    </label>
  );
}

/** GET filter form shown as a toolbar on top of a flush card */
export function FilterBar({ children, apply, reset }: { children: ReactNode; apply: string; reset?: { href: string; label: string } }) {
  return (
    <form className="no-print flex flex-wrap items-end gap-3 border-b border-border px-4 py-3.5 sm:px-5">
      {children}
      <div className="flex items-center gap-1">
        <Button type="submit" variant="secondary">{apply}</Button>
        {reset ? (
          <Link href={reset.href} className={buttonClass("ghost")}>
            {reset.label}
          </Link>
        ) : null}
      </div>
    </form>
  );
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text-2 ring-border-strong/60",
  success: "bg-success-soft text-success ring-success/20",
  warning: "bg-warning-soft text-warning ring-warning/25",
  danger: "bg-danger-soft text-danger ring-danger/20",
  info: "bg-primary-soft text-primary-soft-ink ring-primary/20",
};
export function Badge({ tone = "neutral", dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONES[tone])}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

const ALERT_ICONS = { neutral: InfoIcon, info: InfoIcon, success: SuccessIcon, warning: WarningIcon, danger: DangerIcon };
export function Alert({ tone = "info", title, children }: { tone?: Tone; title?: ReactNode; children?: ReactNode }) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx("flex items-start gap-3 rounded-lg px-3.5 py-3 text-sm ring-1 ring-inset animate-fade-in", TONES[tone])}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <div className="font-semibold">{title}</div> : null}
        {children ? <div className={cx(title ? "mt-0.5 text-text-2" : undefined)}>{children}</div> : null}
      </div>
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm [&_tbody_tr:hover]:bg-surface-2/60 [&_tbody_tr:last-child>td]:border-b-0 [&_tbody_tr]:transition-colors [&_tfoot_td]:border-b-0 [&_tfoot_td]:border-t [&_tfoot_td]:bg-surface-2/60 [&_tfoot_td]:font-semibold">
        {children}
      </table>
    </div>
  );
}
const EDGE = "first:ps-4 last:pe-4 sm:first:ps-5 sm:last:pe-5";
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cx("whitespace-nowrap border-b border-border bg-surface-2/60 px-3 py-2.5 text-start text-xs font-medium text-muted", EDGE, className)}>
      {children}
    </th>
  );
}
export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cx("border-b border-border px-3 py-3 align-middle", EDGE, className)}>
      {children}
    </td>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "danger" | "success";
  icon?: ReactNode;
}) {
  return (
    <div className="print-plain rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.8125rem] font-medium text-muted">{label}</span>
        {icon ? (
          <span
            className={cx(
              "no-print grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4",
              tone === "danger" ? "bg-danger-soft text-danger" : tone === "success" ? "bg-success-soft text-success" : "bg-surface-2 text-text-2",
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className={cx("mt-2 text-2xl font-semibold tracking-tight", tone === "danger" && "text-danger", tone === "success" && "text-success")}>{value}</div>
      {hint ? <div className="mt-1 text-xs leading-relaxed text-muted">{hint}</div> : null}
    </div>
  );
}

export function Empty({ children, icon, action }: { children: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 grid size-11 place-items-center rounded-full bg-surface-2 text-muted [&_svg]:size-5">{icon ?? <InboxIcon />}</div>
      <p className="max-w-sm text-sm text-muted">{children}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Label / value rows for detail screens */
export function DescriptionList({ items }: { items: ({ label: ReactNode; value: ReactNode } | null | false)[] }) {
  return (
    <dl className="divide-y divide-border">
      {items.filter(Boolean).map((it, i) => {
        const { label, value } = it as { label: ReactNode; value: ReactNode };
        return (
          <div key={i} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="min-w-0 text-sm sm:col-span-2">{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-surface-3/70", className)} aria-hidden />;
}

export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("num", className)}>{children}</span>;
}
