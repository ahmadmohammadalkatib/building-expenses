import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { fmt, getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { getSettings, today } from "@/lib/services/common";
import { arrearsReport } from "@/lib/services/reports";
import { whatsappLink } from "@/lib/core/phone";
import type { AgingBucket } from "@/lib/core/accounting";
import { ReportShell } from "@/components/report-shell";
import { Card, Empty, Num, Table, Td, Th } from "@/components/ui";

const BUCKETS: AgingBucket[] = ["current", "d1_30", "d31_60", "d61_90", "d90p"];

export default async function ArrearsReport() {
  await requireUser();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const [d0, s] = await Promise.all([today(sql), getSettings(sql)]);
  const r = await arrearsReport(sql, d0);
  return (
    <ReportShell
      title={t.reports.arrears}
      building={s.building_name}
      generatedOn={f.date(d0)}
      csvHref="/api/export/arrears"
      labels={{ print: t.common.print, csv: t.common.exportCsv, generatedOn: t.reports.generatedOn }}
    >
      <Card>
        {r.list.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t.common.apartment}</Th><Th>{t.common.owner}</Th><Th>{t.reports.oldestDue}</Th>
                {BUCKETS.map((b) => <Th key={b} className="text-end">{t.reports.aging[b]}</Th>)}
                <Th className="text-end">{t.common.total}</Th><Th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {r.list.map((e) => (
                <tr key={e.apartmentId}>
                  <Td><Link className="font-semibold text-primary" href={`/apartments/${e.apartmentId}`}>{e.number}</Link></Td>
                  <Td>{e.ownerName ?? t.common.none}</Td>
                  <Td>{f.date(e.oldestDue)}</Td>
                  {BUCKETS.map((b) => <Td key={b} className="text-end">{e.buckets[b] ? <Num>{f.money(e.buckets[b])}</Num> : ""}</Td>)}
                  <Td className="text-end font-semibold text-danger"><Num>{f.money(e.total)}</Num></Td>
                  <Td className="no-print">
                    {e.phone ? (
                      <a className="text-sm text-primary" target="_blank" rel="noreferrer"
                        href={whatsappLink(e.phone, fmt(t.apartments.reminderText, { name: e.ownerName ?? "", apt: e.number, amount: f.money(e.total) }))}>
                        {t.common.whatsapp}
                      </a>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <Td colSpan={3}>{t.common.total}</Td>
                {BUCKETS.map((b) => <Td key={b} className="text-end"><Num>{f.money(r.totals.buckets[b])}</Num></Td>)}
                <Td className="text-end"><Num>{f.money(r.totals.total)}</Num></Td><Td className="no-print" />
              </tr>
            </tfoot>
          </Table>
        ) : (
          <Empty>{t.common.noData}</Empty>
        )}
      </Card>
    </ReportShell>
  );
}
