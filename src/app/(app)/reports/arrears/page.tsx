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
import { Card, Empty, LINK, LinkButton, Num, Table, Td, Th } from "@/components/ui";
import { MessageIcon, SuccessIcon } from "@/components/icons";

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
      labels={{ print: t.common.print, csv: t.common.exportCsv, generatedOn: t.reports.generatedOn, reports: t.reports.title }}
    >
      <Card flush>
        {r.list.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t.common.apartment}</Th>
                <Th>{t.common.owner}</Th>
                <Th>{t.reports.oldestDue}</Th>
                {BUCKETS.map((b) => <Th key={b} className="text-end">{t.reports.aging[b]}</Th>)}
                <Th className="text-end">{t.common.total}</Th>
                <Th className="no-print"><span className="sr-only">{t.common.whatsapp}</span></Th>
              </tr>
            </thead>
            <tbody>
              {r.list.map((e) => (
                <tr key={e.apartmentId}>
                  <Td><Link className={LINK} href={`/apartments/${e.apartmentId}`}>{e.number}</Link></Td>
                  <Td className="max-w-44 truncate">{e.ownerName ?? <span className="text-muted">{t.common.none}</span>}</Td>
                  <Td className="whitespace-nowrap text-text-2">{f.date(e.oldestDue)}</Td>
                  {BUCKETS.map((b) => (
                    <Td key={b} className="text-end text-text-2">{e.buckets[b] ? <Num>{f.money(e.buckets[b])}</Num> : <span className="text-border-strong">—</span>}</Td>
                  ))}
                  <Td className="text-end font-semibold text-danger"><Num>{f.money(e.total)}</Num></Td>
                  <Td className="no-print text-end">
                    {e.phone ? (
                      <LinkButton
                        variant="ghost"
                        size="sm"
                        target="_blank"
                        rel="noreferrer"
                        prefetch={false}
                        href={whatsappLink(e.phone, fmt(t.apartments.reminderText, { name: e.ownerName ?? "", apt: e.number, amount: f.money(e.total) }))}
                      >
                        <MessageIcon />
                        {t.common.whatsapp}
                      </LinkButton>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <Td colSpan={3}>{t.common.total}</Td>
                {BUCKETS.map((b) => <Td key={b} className="text-end"><Num>{f.money(r.totals.buckets[b])}</Num></Td>)}
                <Td className="text-end text-danger"><Num>{f.money(r.totals.total)}</Num></Td>
                <Td className="no-print" />
              </tr>
            </tfoot>
          </Table>
        ) : (
          <Empty icon={<SuccessIcon />}>{t.common.noData}</Empty>
        )}
      </Card>
    </ReportShell>
  );
}
