import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { getSettings, today } from "@/lib/services/common";
import { collectionsReport } from "@/lib/services/reports";
import { monthStart } from "@/lib/core/dates";
import { ReportShell } from "@/components/report-shell";
import { Button, Card, Empty, Field, Input, Num, Stat, Table, Td, Th } from "@/components/ui";

export default async function CollectionsReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireUser();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const [d0, s] = await Promise.all([today(sql), getSettings(sql)]);
  const sp = await searchParams;
  const from = sp.from || monthStart(d0);
  const to = sp.to || d0;
  const r = await collectionsReport(sql, from, to);
  return (
    <ReportShell
      title={t.reports.collections}
      building={s.building_name}
      generatedOn={f.date(d0)}
      csvHref={`/api/export/collections?from=${from}&to=${to}`}
      labels={{ print: t.common.print, csv: t.common.exportCsv, generatedOn: t.reports.generatedOn, reports: t.reports.title }}
      filters={
        <form className="flex flex-wrap items-end gap-3">
          <Field label={t.common.from} className="w-[calc(50%-0.375rem)] sm:w-40"><Input name="from" type="date" defaultValue={from} /></Field>
          <Field label={t.common.to} className="w-[calc(50%-0.375rem)] sm:w-40"><Input name="to" type="date" defaultValue={to} /></Field>
          <Button type="submit" variant="secondary">{t.common.apply}</Button>
        </form>
      }
    >
      <p className="text-sm text-muted">{f.date(from)} – {f.date(to)}</p>
      <div className="grid gap-6 lg:grid-cols-3">
        <Stat label={t.common.total} value={<Num>{f.money(r.total)}</Num>} hint={`${r.list.length} · ${t.payments.title}`} />
        <Card title={t.reports.byMethod} flush className="lg:col-span-2">
          <Table>
            <tbody>
              {Object.entries(r.byMethod).map(([m, v]) => (
                <tr key={m}>
                  <Td className="text-text-2">{t.methods[m as keyof typeof t.methods]}</Td>
                  <Td className="text-end font-medium"><Num>{f.money(v)}</Num></Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><Td>{t.common.total}</Td><Td className="text-end"><Num>{f.money(r.total)}</Num></Td></tr>
            </tfoot>
          </Table>
        </Card>
      </div>
      <Card flush>
        {r.list.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t.payments.receiptNo}</Th>
                <Th>{t.common.date}</Th>
                <Th>{t.common.apartment}</Th>
                <Th>{t.payments.payer}</Th>
                <Th>{t.common.method}</Th>
                <Th className="text-end">{t.common.amount}</Th>
              </tr>
            </thead>
            <tbody>
              {r.list.map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium"><Num>{p.receipt_no}</Num></Td>
                  <Td className="whitespace-nowrap text-text-2">{f.date(p.payment_date)}</Td>
                  <Td>{p.number}</Td>
                  <Td className="max-w-48 truncate">{p.payer_name}</Td>
                  <Td className="text-text-2">{t.methods[p.method as keyof typeof t.methods]}</Td>
                  <Td className="text-end font-medium"><Num>{f.money(p.amount)}</Num></Td>
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
