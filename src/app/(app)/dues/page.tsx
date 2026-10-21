import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { today } from "@/lib/services/common";
import { chargeList } from "@/lib/services/reports";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Button, Card, Empty, Field, Input, LinkButton, Num, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { ChargeStatus } from "@/components/status";
import { PlusIcon } from "@/components/icons";
import { generateAction } from "./actions";

export default async function DuesPage({ searchParams }: { searchParams: Promise<{ month?: string; status?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const d0 = await today(sql);
  const sp = await searchParams;
  const month = sp.month === undefined ? d0.slice(0, 7) : sp.month;
  const status = sp.status ?? "";
  const rows = await chargeList(sql, { month: month ? `${month}-01` : null, status: status || null }, d0);
  const [lastRun] = await sql<{ run_at: string; month: string; created_count: number }[]>`
    select run_at, month, created_count from job_runs where triggered_by = 'cron' order by run_at desc limit 1`;
  const totals = rows.reduce(
    (s, r) => (r.status === "active" ? { amount: s.amount + r.amount, outstanding: s.outstanding + r.outstanding } : s),
    { amount: 0, outstanding: 0 },
  );
  return (
    <>
      <PageHeader
        title={t.dues.title}
        actions={can(user, "treasurer") ? <LinkButton href="/dues/new" variant="secondary"><PlusIcon className="size-4" />{t.dues.newCharge}</LinkButton> : null}
      />
      <div className="space-y-6">
        {can(user, "treasurer") ? (
          <Card title={t.dues.generate}>
            <p className="mb-3 text-sm text-muted">{t.dues.generateHelp}</p>
            <ActionForm action={generateAction}>
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t.common.month}>
                  <Input name="month" type="month" defaultValue={d0.slice(0, 7)} max={d0.slice(0, 7)} required />
                </Field>
                <SubmitButton>{t.dues.generate}</SubmitButton>
              </div>
            </ActionForm>
            {lastRun ? (
              <p className="mt-3 text-xs text-muted">
                {t.dues.lastRun}: {f.dateTime(lastRun.run_at)} · {f.month(lastRun.month)} · {lastRun.created_count}
              </p>
            ) : null}
          </Card>
        ) : null}
        <Card>
          <form className="no-print mb-4 flex flex-wrap items-end gap-2">
            <Field label={t.common.month}><Input name="month" type="month" defaultValue={month} /></Field>
            <Field label={t.common.status}>
              <Select name="status" defaultValue={status}>
                <option value="">{t.common.all}</option>
                <option value="unpaid">{t.dues.statuses.unpaid}</option>
                <option value="partial">{t.dues.statuses.partial}</option>
                <option value="paid">{t.dues.statuses.paid}</option>
                <option value="overdue">{t.dues.statuses.overdue}</option>
                <option value="voided">{t.dues.statuses.voided}</option>
              </Select>
            </Field>
            <Button type="submit" variant="secondary">{t.common.apply}</Button>
            <Link href="/dues?month=" className="px-2 py-2 text-sm text-primary">{t.common.all}</Link>
          </form>
          {rows.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t.common.apartment}</Th><Th>{t.dues.billingMonth}</Th><Th>{t.dues.kind}</Th><Th>{t.dues.dueDate}</Th>
                  <Th className="text-end">{t.common.amount}</Th><Th className="text-end">{t.dues.paid}</Th><Th className="text-end">{t.dues.outstanding}</Th><Th>{t.common.status}</Th><Th className="no-print" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.status === "voided" ? "text-muted" : ""}>
                    <Td><Link className="font-semibold text-primary" href={`/apartments/${r.apartment_id}`}>{r.number}</Link></Td>
                    <Td><Link className="text-primary" href={`/dues/${r.id}`}>{f.month(r.billing_month)}</Link></Td>
                    <Td>{t.dues.kinds[r.kind as keyof typeof t.dues.kinds]}{r.description ? <span className="text-muted"> · {r.description}</span> : null}</Td>
                    <Td className="text-muted">{f.date(r.due_date)}</Td>
                    <Td className="text-end"><Num>{f.money(r.amount)}</Num></Td>
                    <Td className="text-end text-success"><Num>{f.money(r.paid + r.adjusted)}</Num></Td>
                    <Td className="text-end font-medium"><Num>{f.money(r.outstanding)}</Num></Td>
                    <Td><ChargeStatus t={t} state={r.state} voided={r.status === "voided"} /></Td>
                    <Td className="no-print">
                      {can(user, "treasurer") && r.status === "active" ? (
                        <Link className="text-sm text-primary" href={`/dues/${r.id}`}>{t.dues.editCharge}</Link>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <Td colSpan={4}>{t.common.total}</Td>
                  <Td className="text-end"><Num>{f.money(totals.amount)}</Num></Td>
                  <Td />
                  <Td className="text-end"><Num>{f.money(totals.outstanding)}</Num></Td>
                  <Td />
                  <Td className="no-print" />
                </tr>
              </tfoot>
            </Table>
          ) : (
            <Empty>{t.common.noData}</Empty>
          )}
        </Card>
      </div>
    </>
  );
}
