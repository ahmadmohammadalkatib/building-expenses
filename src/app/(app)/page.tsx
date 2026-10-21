import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { fmt, getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { getSettings, today } from "@/lib/services/common";
import { dashboard } from "@/lib/services/reports";
import { listFees } from "@/lib/services/setup";
import { Alert, Badge, Card, Empty, LinkButton, Num, PageHeader, Stat, Table, Td, Th } from "@/components/ui";
import { CashFlowChart } from "@/components/charts";
import { PlusIcon } from "@/components/icons";
import { formatMonth } from "@/lib/core/dates";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ pw?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const [s, d0, fees] = await Promise.all([getSettings(sql), today(sql), listFees(sql)]);
  const d = await dashboard(sql, d0);
  const { pw } = await searchParams;
  const needsSetup = !s.opening_date || fees.length === 0;
  const maxCat = Math.max(1, ...d.categories.map((c) => c.total));

  return (
    <>
      <PageHeader
        title={t.nav.dashboard}
        subtitle={f.date(d0)}
        actions={
          can(user, "treasurer") ? (
            <>
              <LinkButton href="/payments/new"><PlusIcon className="size-4" />{t.payments.new}</LinkButton>
              <LinkButton href="/expenses/new" variant="secondary"><PlusIcon className="size-4" />{t.expenses.new}</LinkButton>
            </>
          ) : null
        }
      />
      <div className="space-y-6">
        {pw ? <Alert tone="success">{t.auth.changed}</Alert> : null}
        {needsSetup && can(user, "admin") ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{t.dashboard.setupTitle}</div>
                <div className="text-sm text-muted">{t.dashboard.setupBody}</div>
              </div>
              <LinkButton href="/settings">{t.dashboard.setupCta}</LinkButton>
            </div>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t.dashboard.fund} value={<Num>{f.money(d.cash)}</Num>} hint={s.opening_date ? fmt(t.dashboard.fundOpening, { amount: f.money(s.opening_balance) }) : t.dashboard.fundHint} tone={d.cash < 0 ? "danger" : undefined} />
          <Stat label={t.dashboard.dues} value={<Num>{f.money(d.dues)}</Num>} hint={t.dashboard.duesHint} tone={d.dues > 0 ? "danger" : undefined} />
          <Stat label={t.dashboard.collected} value={<Num>{f.money(d.month.collected)}</Num>} hint={`${t.dashboard.unpaidThisMonth}: ${d.counts.unpaid_this_month} / ${d.counts.apartments}`} />
          <Stat label={t.dashboard.spent} value={<Num>{f.money(d.month.spent)}</Num>} hint={d.credit ? `${t.dashboard.credit}: ${f.money(d.credit)}` : undefined} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title={t.dashboard.chartTitle} className="lg:col-span-2">
            <CashFlowChart
              rtl={locale === "ar"}
              labels={{ collections: t.dashboard.collections, expenses: t.dashboard.expenses }}
              data={d.series.map((r) => ({
                label: formatMonth(r.month, locale).replace(/\s*\d{4}$/, ""),
                collections: r.collections,
                expenses: r.expenses,
              }))}
            />
          </Card>
          <Card title={t.dashboard.byCategory}>
            {d.categories.length ? (
              <ul className="space-y-3">
                {d.categories.map((c) => (
                  <li key={c.name_ar}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{locale === "ar" ? c.name_ar : c.name_en || c.name_ar}</span>
                      <Num className="text-muted">{f.money(c.total)}</Num>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2">
                      <div className="h-2 rounded-full bg-[var(--chart-2)]" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{t.common.noData}</Empty>
            )}
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t.dashboard.topDebtors} actions={<Link className="text-sm text-primary" href="/reports/arrears">{t.common.view}</Link>}>
            {d.debtors.length ? (
              <Table>
                <thead>
                  <tr><Th>{t.common.apartment}</Th><Th>{t.common.owner}</Th><Th>{t.reports.oldestDue}</Th><Th className="text-end">{t.dues.outstanding}</Th></tr>
                </thead>
                <tbody>
                  {d.debtors.map((r) => (
                    <tr key={r.id}>
                      <Td><Link className="font-medium text-primary" href={`/apartments/${r.id}`}>{r.number}</Link></Td>
                      <Td>{r.owner_name ?? t.common.none}</Td>
                      <Td className="text-muted">{f.date(r.oldest_due)}</Td>
                      <Td className="text-end font-medium text-danger"><Num>{f.money(r.outstanding)}</Num></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Empty>{t.common.noData}</Empty>
            )}
          </Card>
          <Card title={t.dashboard.recent}>
            {d.recent.length ? (
              <ul className="divide-y divide-border">
                {d.recent.map((r) => (
                  <li key={r.kind + r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link href={`/${r.kind === "payment" ? "payments" : "expenses"}/${r.id}`} className="flex min-w-0 items-center gap-2">
                      <Badge tone={r.kind === "payment" ? "success" : "warning"}>
                        {r.kind === "payment" ? t.dashboard.payment : t.dashboard.expense}
                      </Badge>
                      <span className="truncate">{r.kind === "payment" ? `${t.common.apartment} ${r.label}` : r.label}</span>
                      {r.status === "voided" ? <Badge tone="danger">{t.common.voided}</Badge> : null}
                    </Link>
                    <div className="shrink-0 text-end">
                      <Num className={r.status === "voided" ? "text-muted line-through" : r.kind === "payment" ? "text-success" : ""}>
                        {r.kind === "payment" ? "+" : "−"}{f.money(r.amount)}
                      </Num>
                      <div className="text-xs text-muted">{f.date(r.date)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{t.common.noData}</Empty>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
