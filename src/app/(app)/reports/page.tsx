import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import { ArrowRightIcon, ClockIcon, CollectIcon, FileIcon, ReceiptIcon, ScaleIcon } from "@/components/icons";

export default async function ReportsPage() {
  await requireUser();
  const { t } = await getDict();
  const items = [
    { href: "/reports/monthly", title: t.reports.monthly, desc: t.reports.monthlyDesc, icon: ScaleIcon },
    { href: "/reports/statement", title: t.reports.statement, desc: t.reports.statementDesc, icon: FileIcon },
    { href: "/reports/arrears", title: t.reports.arrears, desc: t.reports.arrearsDesc, icon: ClockIcon },
    { href: "/reports/expenses", title: t.reports.expenses, desc: t.reports.expensesDesc, icon: ReceiptIcon },
    { href: "/reports/collections", title: t.reports.collections, desc: t.reports.collectionsDesc, icon: CollectIcon },
  ];
  return (
    <>
      <PageHeader title={t.reports.title} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ href, title, desc, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col rounded-xl border border-border bg-surface p-5 shadow-xs transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
          >
            <span className="mb-4 grid size-9 place-items-center rounded-lg bg-primary-soft text-primary-soft-ink">
              <Icon className="size-[1.125rem]" aria-hidden />
            </span>
            <span className="flex items-center justify-between gap-2 font-semibold">
              {title}
              <ArrowRightIcon className="size-4 text-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
            </span>
            <span className="mt-1 text-sm leading-relaxed text-muted">{desc}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
