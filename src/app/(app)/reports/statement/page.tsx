import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { getSettings, today } from "@/lib/services/common";
import { apartmentDetail, apartmentList, apartmentStatement } from "@/lib/services/reports";
import { ReportShell } from "@/components/report-shell";
import { Button, Card, Empty, Field, Num, Select, Table, Td, Th } from "@/components/ui";

export default async function StatementReport({ searchParams }: { searchParams: Promise<{ apartment?: string }> }) {
  await requireUser();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const [d0, s, active, archived] = await Promise.all([today(sql), getSettings(sql), apartmentList(sql, {}), apartmentList(sql, { archived: true })]);
  const apts = [...active, ...archived];
  const { apartment } = await searchParams;
  const sel = apartment && /^[0-9a-f-]{36}$/.test(apartment) ? apartment : null;
  const [detail, st] = sel ? await Promise.all([apartmentDetail(sql, sel), apartmentStatement(sql, sel)]) : [null, null];
  const label = (ty: string, kind?: string) =>
    ty === "charge" ? t.dues.kinds[(kind ?? "other") as keyof typeof t.dues.kinds] : ty === "payment" ? t.dashboard.payment : ty === "opening_credit" ? t.payments.openingCredit : t.dues.adjKinds[(kind ?? "waiver") as keyof typeof t.dues.adjKinds];
  return (
    <ReportShell
      title={detail ? `${t.reports.statement} — ${t.common.apartment} ${detail.apt.number}` : t.reports.statement}
      building={s.building_name}
      generatedOn={f.date(d0)}
      csvHref={sel ? `/api/export/statement?apartment=${sel}` : undefined}
      labels={{ print: t.common.print, csv: t.common.exportCsv, generatedOn: t.reports.generatedOn }}
      filters={
        <form className="flex flex-wrap items-end gap-2">
          <Field label={t.reports.chooseApartment}>
            <Select name="apartment" defaultValue={sel ?? ""} required>
              <option value="" disabled>—</option>
              {apts.map((a) => <option key={a.id} value={a.id}>{a.number}{a.owner_name ? ` — ${a.owner_name}` : ""}</option>)}
            </Select>
          </Field>
          <Button type="submit" variant="secondary">{t.common.apply}</Button>
        </form>
      }
    >
      {detail && st ? (
        <Card>
          <div className="mb-4 flex flex-wrap justify-between gap-2 text-sm">
            <div>{t.common.owner}: <span className="font-medium">{detail.owner?.full_name ?? t.common.none}</span></div>
            <div>
              {t.apartments.balance}:{" "}
              <span className={`font-semibold ${st.balance > 0 ? "text-danger" : "text-success"}`}>
                <Num>{f.money(Math.abs(st.balance))}</Num> {st.balance > 0 ? t.apartments.owes : st.balance < 0 ? t.apartments.inCredit : ""}
              </span>
            </div>
          </div>
          {st.lines.length ? (
            <Table>
              <thead>
                <tr><Th>{t.common.date}</Th><Th>{t.dues.kind}</Th><Th>{t.common.description}</Th><Th className="text-end">{t.dues.title}</Th><Th className="text-end">{t.payments.title}</Th><Th className="text-end">{t.apartments.balance}</Th></tr>
              </thead>
              <tbody>
                {st.lines.map((l) => (
                  <tr key={l.type + l.id}>
                    <Td>{l.type === "charge" ? f.month(l.date) : f.date(l.date)}</Td>
                    <Td>{label(l.type, l.kind)}</Td>
                    <Td className="text-muted">{l.ref ? <Num>{l.ref}</Num> : null} {l.description}</Td>
                    <Td className="text-end">{l.debit ? <Num>{f.money(l.debit)}</Num> : ""}</Td>
                    <Td className="text-end">{l.credit ? <Num>{f.money(l.credit)}</Num> : ""}</Td>
                    <Td className="text-end font-medium"><Num>{l.balance < 0 ? "−" : ""}{f.money(Math.abs(l.balance))}</Num></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty>{t.common.noData}</Empty>
          )}
        </Card>
      ) : null}
    </ReportShell>
  );
}
