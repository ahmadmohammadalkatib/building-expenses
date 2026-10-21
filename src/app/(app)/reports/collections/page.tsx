import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { getSettings, today } from "@/lib/services/common";
import { collectionsReport } from "@/lib/services/reports";
import { monthStart } from "@/lib/core/dates";
import { ReportShell } from "@/components/report-shell";
import { Button, Card, Empty, Field, Input, Num, Table, Td, Th } from "@/components/ui";

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
      labels={{ print: t.common.print, csv: t.common.exportCsv, generatedOn: t.reports.generatedOn }}
      filters={
        <form className="flex flex-wrap items-end gap-2">
          <Field label={t.common.from}><Input name="from" type="date" defaultValue={from} /></Field>
          <Field label={t.common.to}><Input name="to" type="date" defaultValue={to} /></Field>
          <Button type="submit" variant="secondary">{t.common.apply}</Button>
        </form>
      }
    >
      <p className="text-sm text-muted">{f.date(from)} – {f.date(to)}</p>
      <Card title={t.reports.byMethod}>
        <Table>
          <tbody>
            {Object.entries(r.byMethod).map(([m, v]) => (
              <tr key={m}><Td>{t.methods[m as keyof typeof t.methods]}</Td><Td className="text-end"><Num>{f.money(v)}</Num></Td></tr>
            ))}
            <tr className="font-semibold"><Td>{t.common.total}</Td><Td className="text-end"><Num>{f.money(r.total)}</Num></Td></tr>
          </tbody>
        </Table>
      </Card>
      <Card>
        {r.list.length ? (
          <Table>
            <thead><tr><Th>{t.payments.receiptNo}</Th><Th>{t.common.date}</Th><Th>{t.common.apartment}</Th><Th>{t.payments.payer}</Th><Th>{t.common.method}</Th><Th className="text-end">{t.common.amount}</Th></tr></thead>
            <tbody>
              {r.list.map((p) => (
                <tr key={p.id}>
                  <Td><Num>{p.receipt_no}</Num></Td><Td>{f.date(p.payment_date)}</Td><Td>{p.number}</Td><Td>{p.payer_name}</Td>
                  <Td>{t.methods[p.method as keyof typeof t.methods]}</Td><Td className="text-end"><Num>{f.money(p.amount)}</Num></Td>
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
