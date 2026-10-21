import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { fmt, getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { getSettings, today } from "@/lib/services/common";
import { dashboard } from "@/lib/services/reports";
import { listFees } from "@/lib/services/setup";
import { Alert, Badge, Card, Empty, LINK, LinkButton, Num, PageHeader, Stat, Table, Td, Th, cx } from "@/components/ui";
import { CashFlowChart } from "@/components/charts";
import {
  ArrowDownLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  CollectIcon,
  DuesIcon,
  FundIcon,
  GearIcon as SettingsIcon,
  PlusIcon,
  SpendIcon,
} from "@/components/icons";
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
  const viewAll = (href: string) => (
    <Link href={href} className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
      {t.common.view}
      <ArrowRightIcon className="size-3.5 rtl:rotate-180" aria-hidden />
    </Link>
  );

  return (
    <>
      <PageHeader
        title={t.nav.dashboard}
        subtitle={f.date(d0)}
        actions={
          can(user, "treasurer") ? (
            <>
              <LinkButton href="/expenses/new" variant="secondary"><PlusIcon />{t.expenses.new}</LinkButton>
              <LinkButton href="/payments/new"><PlusIcon />{t.payments.new}</LinkButton>
            </>
          ) : null
        }
      />
      <div className="space-y-6">
        {pw ? <Alert tone="success">{t.auth.changed}</Alert> : null}
        {needsSetup && can(user, "admin") ? (
          <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-primary shadow-xs">
                <SettingsIcon className="size-[1.125rem]" aria-hidden />
              </span>
              <div>
                <div className="font-semibold">{t.dashboard.setupTitle}</div>
                <div className="mt-0.5 text-sm text-text-2">{t.dashboard.setupBody}</div>
              </div>
            </div>
            <LinkButton href="/settings">{t.dashboard.setupCta}</LinkButton>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label={t.dashboard.fund}
            icon={<FundIcon />}
            value={<Num>{f.money(d.cash)}</Num>}
            hint={s.opening_date ? fmt(t.dashboard.fundOpening, { amount: f.money(s.opening_balance) }) : t.dashboard.fundHint}
            tone={d.cash < 0 ? "danger" : undefined}
          />
          <Stat
            label={t.dashboard.dues}
            icon={<DuesIcon />}
            value={<Num>{f.money(d.dues)}</Num>}
            hint={t.dashboard.duesHint}
            tone={d.dues > 0 ? "danger" : undefined}
          />
          <Stat
            label={t.dashboard.collected}
            icon={<CollectIcon />}
            value={<Num>{f.money(d.month.collected)}</Num>}
            hint={
              <>
                {t.dashboard.unpaidThisMonth}: <Num>{`${d.counts.unpaid_this_month} / ${d.counts.apartments}`}</Num>
              </>
            }
          />
          <Stat
            label={t.dashboard.spent}
            icon={<SpendIcon />}
            value={<Num>{f.money(d.month.spent)}</Num>}
            hint={d.credit ? <>{t.dashboard.credit}: <Num>{f.money(d.credit)}</Num></> : undefined}
          />
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
              <ul className="space-y-4">
                {d.categories.map((c) => (
                  <li key={c.name_ar}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate text-text-2">{locale === "ar" ? c.name_ar : c.name_en || c.name_ar}</span>
                      <Num className="font-medium">{f.money(c.total)}</Num>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.max(2, (c.total / maxCat) * 100)}%` }} />
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
          <Card title={t.dashboard.topDebtors} actions={viewAll("/reports/arrears")} flush>
            {d.debtors.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>{t.common.apartment}</Th>
                    <Th>{t.common.owner}</Th>
                    <Th className="hidden sm:table-cell">{t.reports.oldestDue}</Th>
                    <Th className="text-end">{t.dues.outstanding}</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.debtors.map((r) => (
                    <tr key={r.id}>
                      <Td><Link className={LINK} href={`/apartments/${r.id}`}>{r.number}</Link></Td>
                      <Td className="max-w-40 truncate">{r.owner_name ?? <span className="text-muted">{t.common.none}</span>}</Td>
                      <Td className="hidden text-muted sm:table-cell">{f.date(r.oldest_due)}</Td>
                      <Td className="text-end font-medium text-danger"><Num>{f.money(r.outstanding)}</Num></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Empty>{t.common.noData}</Empty>
            )}
          </Card>
          <Card title={t.dashboard.recent} flush>
            {d.recent.length ? (
              <ul className="divide-y divide-border">
                {d.recent.map((r) => {
                  const isPayment = r.kind === "payment";
                  const voided = r.status === "voided";
                  return (
                    <li key={r.kind + r.id}>
                      <Link
                        href={`/${isPayment ? "payments" : "expenses"}/${r.id}`}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60 sm:px-5"
                      >
                        <span
                          className={cx(
                            "grid size-8 shrink-0 place-items-center rounded-full",
                            isPayment ? "bg-success-soft text-success" : "bg-surface-2 text-text-2",
                          )}
                          aria-hidden
                        >
                          {isPayment ? <ArrowDownLeftIcon className="size-4" /> : <ArrowUpRightIcon className="size-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {isPayment ? `${t.common.apartment} ${r.label}` : r.label}
                            </span>
                            {voided ? <Badge tone="danger">{t.common.voided}</Badge> : null}
                          </span>
                          <span className="block text-xs text-muted">
                            {isPayment ? t.dashboard.payment : t.dashboard.expense} · {f.date(r.date)}
                          </span>
                        </span>
                        <Num
                          className={cx(
                            "shrink-0 text-sm font-medium",
                            voided ? "text-muted line-through" : isPayment ? "text-success" : "text-text",
                          )}
                        >
                          {isPayment ? "+" : "−"}
                          {f.money(r.amount)}
                        </Num>
                      </Link>
                    </li>
                  );
                })}
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
