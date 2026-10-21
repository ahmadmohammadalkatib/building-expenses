import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { today } from "@/lib/services/common";
import { chargeList } from "@/lib/services/reports";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Dialog } from "@/components/dialog";
import { Card, Empty, Field, FilterBar, Input, LINK, LinkButton, Num, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { ChargeStatus } from "@/components/status";
import { ClockIcon, EditIcon, ListIcon, PlusIcon, RefreshIcon } from "@/components/icons";
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
  const canEdit = can(user, "treasurer");
  return (
    <>
      <PageHeader
        title={t.dues.title}
        subtitle={
          lastRun ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <ClockIcon className="size-3.5" aria-hidden />
              {t.dues.lastRun}: {f.dateTime(lastRun.run_at)} · {f.month(lastRun.month)} · <Num>{lastRun.created_count}</Num>
            </span>
          ) : undefined
        }
        actions={
          canEdit ? (
            <>
              <Dialog
                label={t.dues.generate}
                icon={<RefreshIcon />}
                title={t.dues.generate}
                description={t.dues.generateHelp}
                closeLabel={t.common.close}
              >
                <ActionForm action={generateAction}>
                  <Field label={t.common.month}>
                    <Input name="month" type="month" defaultValue={d0.slice(0, 7)} max={d0.slice(0, 7)} required />
                  </Field>
                  <div className="flex justify-end">
                    <SubmitButton>{t.dues.generate}</SubmitButton>
                  </div>
                </ActionForm>
              </Dialog>
              <LinkButton href="/dues/new"><PlusIcon />{t.dues.newCharge}</LinkButton>
            </>
          ) : null
        }
      />
      <Card flush>
        <FilterBar apply={t.common.apply} reset={month ? { href: "/dues?month=", label: t.common.all } : undefined}>
          <Field label={t.common.month} className="w-full sm:w-44"><Input name="month" type="month" defaultValue={month} /></Field>
          <Field label={t.common.status} className="w-full sm:w-44">
            <Select name="status" defaultValue={status}>
              <option value="">{t.common.all}</option>
              <option value="unpaid">{t.dues.statuses.unpaid}</option>
              <option value="partial">{t.dues.statuses.partial}</option>
              <option value="paid">{t.dues.statuses.paid}</option>
              <option value="overdue">{t.dues.statuses.overdue}</option>
              <option value="voided">{t.dues.statuses.voided}</option>
            </Select>
          </Field>
        </FilterBar>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t.common.apartment}</Th>
                <Th>{t.dues.billingMonth}</Th>
                <Th className="hidden md:table-cell">{t.dues.kind}</Th>
                <Th className="hidden lg:table-cell">{t.dues.dueDate}</Th>
                <Th className="text-end">{t.common.amount}</Th>
                <Th className="hidden text-end sm:table-cell">{t.dues.paid}</Th>
                <Th className="text-end">{t.dues.outstanding}</Th>
                <Th>{t.common.status}</Th>
                {canEdit ? <Th className="no-print"><span className="sr-only">{t.common.actions}</span></Th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.status === "voided" ? "text-muted" : ""}>
                  <Td><Link className={LINK} href={`/apartments/${r.apartment_id}`}>{r.number}</Link></Td>
                  <Td><Link className="text-text-2 underline-offset-4 hover:text-primary hover:underline" href={`/dues/${r.id}`}>{f.month(r.billing_month)}</Link></Td>
                  <Td className="hidden max-w-56 truncate md:table-cell">
                    {t.dues.kinds[r.kind as keyof typeof t.dues.kinds]}
                    {r.description ? <span className="text-muted"> · {r.description}</span> : null}
                  </Td>
                  <Td className="hidden text-muted lg:table-cell">{f.date(r.due_date)}</Td>
                  <Td className="text-end"><Num>{f.money(r.amount)}</Num></Td>
                  <Td className="hidden text-end text-success sm:table-cell"><Num>{f.money(r.paid + r.adjusted)}</Num></Td>
                  <Td className="text-end font-medium"><Num>{f.money(r.outstanding)}</Num></Td>
                  <Td><ChargeStatus t={t} state={r.state} voided={r.status === "voided"} /></Td>
                  {canEdit ? (
                    <Td className="no-print text-end">
                      {r.status === "active" ? (
                        <LinkButton href={`/dues/${r.id}`} variant="ghost" size="sm" aria-label={`${t.dues.editCharge} ${r.number}`}>
                          <EditIcon />
                          <span className="hidden xl:inline">{t.dues.editCharge}</span>
                        </LinkButton>
                      ) : null}
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <Td colSpan={2}>{t.common.total}</Td>
                <Td className="hidden md:table-cell" />
                <Td className="hidden lg:table-cell" />
                <Td className="text-end"><Num>{f.money(totals.amount)}</Num></Td>
                <Td className="hidden sm:table-cell" />
                <Td className="text-end"><Num>{f.money(totals.outstanding)}</Num></Td>
                <Td />
                {canEdit ? <Td className="no-print" /> : null}
              </tr>
            </tfoot>
          </Table>
        ) : (
          <Empty icon={<ListIcon />}>{t.common.noData}</Empty>
        )}
      </Card>
    </>
  );
}
