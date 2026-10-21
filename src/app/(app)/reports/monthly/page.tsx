import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { getSettings, today } from "@/lib/services/common";
import { monthlySummary } from "@/lib/services/reports";
import { ReportShell } from "@/components/report-shell";
import { Alert, Button, Card, Field, Input, Num, Table, Td, Th } from "@/components/ui";

export default async function MonthlyReport({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireUser();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const [d0, s] = await Promise.all([today(sql), getSettings(sql)]);
  const { month = d0.slice(0, 7) } = await searchParams;
  const r = await monthlySummary(sql, `${month}-01`);
  const row = (label: string, v: number, strong = false, sign = "") => (
    <tr className={strong ? "font-semibold" : ""}>
      <Td>{label}</Td>
      <Td className="text-end"><Num>{sign}{f.money(v)}</Num></Td>
    </tr>
  );
  return (
    <ReportShell
      title={`${t.reports.monthly} — ${f.month(r.month)}`}
      building={s.building_name}
      generatedOn={f.date(d0)}
      csvHref={`/api/export/monthly?month=${month}`}
      labels={{ print: t.common.print, csv: t.common.exportCsv, generatedOn: t.reports.generatedOn }}
      filters={
        <form className="flex items-end gap-2">
          <Field label={t.common.month}><Input name="month" type="month" defaultValue={month} /></Field>
          <Button type="submit" variant="secondary">{t.common.apply}</Button>
        </form>
      }
    >
      {r.beforeOpening ? <Alert tone="warning">{t.reports.beforeOpening}</Alert> : null}
      <Alert tone="info">{t.reports.neverAdd}</Alert>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t.reports.cashSection}>
          <Table>
            <tbody>
              {row(t.reports.openingCash, r.cash.opening)}
              {row(t.dashboard.collections, r.cash.collections, false, "+ ")}
              {row(t.dashboard.expenses, r.cash.expenses, false, "− ")}
              {row(t.reports.closingCash, r.cash.closing, true)}
            </tbody>
          </Table>
        </Card>
        <Card title={t.reports.duesSection}>
          <Table>
            <tbody>
              {row(t.reports.openingDues, r.dues.opening)}
              {row(t.reports.billed, r.dues.billed, false, "+ ")}
              {row(t.reports.collectedDues, r.dues.collected, false, "− ")}
              {row(t.reports.adjustedDues, r.dues.adjusted, false, "− ")}
              {row(t.reports.closingDues, r.dues.closing, true)}
              {row(t.reports.creditHeld, r.creditHeld)}
            </tbody>
          </Table>
        </Card>
      </div>
      <Card title={t.reports.byCategory}>
        <Table>
          <thead><tr><Th>{t.expenses.category}</Th><Th className="text-end">{t.common.amount}</Th></tr></thead>
          <tbody>
            {r.byCategory.map((c) => (
              <tr key={c.name_ar}><Td>{locale === "ar" ? c.name_ar : c.name_en || c.name_ar}</Td><Td className="text-end"><Num>{f.money(c.total)}</Num></Td></tr>
            ))}
            <tr className="font-semibold"><Td>{t.common.total}</Td><Td className="text-end"><Num>{f.money(r.cash.expenses)}</Num></Td></tr>
          </tbody>
        </Table>
      </Card>
    </ReportShell>
  );
}
