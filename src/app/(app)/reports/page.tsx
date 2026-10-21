import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";

export default async function ReportsPage() {
  await requireUser();
  const { t } = await getDict();
  const items = [
    { href: "/reports/monthly", title: t.reports.monthly, desc: t.reports.monthlyDesc },
    { href: "/reports/statement", title: t.reports.statement, desc: t.reports.statementDesc },
    { href: "/reports/arrears", title: t.reports.arrears, desc: t.reports.arrearsDesc },
    { href: "/reports/expenses", title: t.reports.expenses, desc: t.reports.expensesDesc },
    { href: "/reports/collections", title: t.reports.collections, desc: t.reports.collectionsDesc },
  ];
  return (
    <>
      <PageHeader title={t.reports.title} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:border-primary">
            <div className="font-semibold">{i.title}</div>
            <div className="mt-1 text-sm text-muted">{i.desc}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
