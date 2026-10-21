import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { getSettings, today } from "@/lib/services/common";
import { expensesReport } from "@/lib/services/reports";
import { listCategories } from "@/lib/services/setup";
import { monthStart } from "@/lib/core/dates";
import { ReportShell } from "@/components/report-shell";
import { Button, Card, Empty, Field, Input, Num, Select, Table, Td, Th } from "@/components/ui";

export default async function ExpensesReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; category?: string }> }) {
  await requireUser();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const [d0, s, cats] = await Promise.all([today(sql), getSettings(sql), listCategories(sql, true)]);
  const sp = await searchParams;
  const from = sp.from || monthStart(d0);
  const to = sp.to || d0;
  const cat = sp.category && /^[0-9a-f-]{36}$/.test(sp.category) ? sp.category : null;
  const r = await expensesReport(sql, from, to, cat);
  const name = (ar: string, en: string) => (locale === "ar" ? ar : en || ar);
  return (
    <ReportShell
      title={t.reports.expenses}
      building={s.building_name}
      generatedOn={f.date(d0)}
      csvHref={`/api/export/expenses?from=${from}&to=${to}${cat ? `&category=${cat}` : ""}`}
      labels={{ print: t.common.print, csv: t.common.exportCsv, generatedOn: t.reports.generatedOn }}
      filters={
        <form className="flex flex-wrap items-end gap-2">
          <Field label={t.common.from}><Input name="from" type="date" defaultValue={from} /></Field>
          <Field label={t.common.to}><Input name="to" type="date" defaultValue={to} /></Field>
          <Field label={t.expenses.category}>
            <Select name="category" defaultValue={cat ?? ""}>
              <option value="">{t.common.all}</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{name(c.name_ar, c.name_en)}</option>)}
            </Select>
          </Field>
          <Button type="submit" variant="secondary">{t.common.apply}</Button>
        </form>
      }
    >
      <p className="text-sm text-muted">{f.date(from)} – {f.date(to)}</p>
      <Card title={t.reports.byCategory}>
        <Table>
          <thead><tr><Th>{t.expenses.category}</Th><Th className="text-end">{t.reports.count}</Th><Th className="text-end">{t.common.amount}</Th></tr></thead>
          <tbody>
            {r.byCategory.map((c) => (
              <tr key={c.ar}><Td>{name(c.ar, c.en)}</Td><Td className="text-end">{c.count}</Td><Td className="text-end"><Num>{f.money(c.total)}</Num></Td></tr>
            ))}
            <tr className="font-semibold"><Td>{t.common.total}</Td><Td className="text-end">{r.list.length}</Td><Td className="text-end"><Num>{f.money(r.total)}</Num></Td></tr>
          </tbody>
        </Table>
      </Card>
      <Card>
        {r.list.length ? (
          <Table>
            <thead><tr><Th>{t.common.date}</Th><Th>{t.expenses.category}</Th><Th>{t.expenses.vendor}</Th><Th>{t.common.description}</Th><Th>{t.common.method}</Th><Th className="text-end">{t.common.amount}</Th></tr></thead>
            <tbody>
              {r.list.map((e) => (
                <tr key={e.id}>
                  <Td>{f.date(e.expense_date)}</Td><Td>{name(e.category_ar, e.category_en)}</Td><Td>{e.vendor}</Td>
                  <Td className="text-muted">{e.description}</Td><Td>{t.methods[e.method as keyof typeof t.methods]}</Td>
                  <Td className="text-end"><Num>{f.money(e.amount)}</Num></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>{t.common.noData}</Empty>
        )}
      </Card>
    </ReportShell>
  );
}
