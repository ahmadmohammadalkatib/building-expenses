import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { today } from "@/lib/services/common";
import { chargeState } from "@/lib/core/accounting";
import { ActionForm, Disclosure, SubmitButton } from "@/components/forms";
import { Alert, Badge, Card, Empty, Field, Input, Num, PageHeader, Select, Stat, Table, Td, Th } from "@/components/ui";
import { ChargeStatus } from "@/components/status";
import { adjustAction, editChargeAction, voidAdjustmentAction, voidChargeAction } from "../actions";

export default async function ChargePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const d0 = await today(sql);
  const [c] = await sql<
    { id: string; apartment_id: string; number: string; kind: string; billing_month: string; due_date: string; amount: number; paid: number; adjusted: number; outstanding: number; status: string; description: string; void_reason: string | null; voided_at: string | null; created_at: string }[]
  >`select cb.*, a.number from charge_balances cb join apartments a on a.id = cb.apartment_id where cb.id = ${id}`;
  if (!c) notFound();
  const allocations = await sql<{ id: string; payment_id: string; receipt_no: string | null; amount: number; effective_date: string; released_at: string | null; pstatus: string }[]>`
    select al.id, al.payment_id, p.receipt_no, al.amount, al.effective_date, al.released_at, p.status as pstatus
    from allocations al join payments p on p.id = al.payment_id where al.charge_id = ${id} order by al.created_at`;
  const adjustments = await sql<{ id: string; kind: string; amount: number; adj_date: string; reason: string; status: string }[]>`
    select id, kind, amount, adj_date, reason, status from adjustments where charge_id = ${id} order by created_at`;
  const state = c.status === "voided" ? null : chargeState(c.amount, c.paid, c.adjusted, c.due_date, d0);
  const canEdit = can(user, "treasurer") && c.status === "active";

  return (
    <>
      <PageHeader
        title={`${t.dues.kinds[c.kind as keyof typeof t.dues.kinds]} — ${f.month(c.billing_month)}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link className="text-primary" href={`/apartments/${c.apartment_id}`}>{t.common.apartment} {c.number}</Link>
            <span>· {t.dues.dueDate}: {f.date(c.due_date)}</span>
            <ChargeStatus t={t} state={state} voided={c.status === "voided"} />
          </span>
        }
      />
      <div className="space-y-6">
        {c.status === "voided" ? <Alert tone="danger">{t.common.voided}: {c.void_reason}</Alert> : null}
        {c.description ? <p className="text-sm">{c.description}</p> : null}
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label={t.common.amount} value={<Num>{f.money(c.amount)}</Num>} />
          <Stat label={t.dues.paid} value={<Num>{f.money(c.paid)}</Num>} />
          <Stat label={t.dues.adjusted} value={<Num>{f.money(c.adjusted)}</Num>} />
          <Stat label={t.dues.outstanding} value={<Num>{f.money(c.outstanding)}</Num>} tone={c.outstanding > 0 ? "danger" : "success"} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t.dues.allocations}>
            {allocations.length ? (
              <Table>
                <thead><tr><Th>{t.payments.receiptNo}</Th><Th>{t.common.date}</Th><Th className="text-end">{t.common.amount}</Th><Th /></tr></thead>
                <tbody>
                  {allocations.map((a) => (
                    <tr key={a.id} className={a.released_at || a.pstatus === "voided" ? "text-muted line-through" : ""}>
                      <Td><Link className="text-primary" href={`/payments/${a.payment_id}`}><Num>{a.receipt_no ?? t.payments.openingCredit}</Num></Link></Td>
                      <Td>{f.date(a.effective_date)}</Td>
                      <Td className="text-end"><Num>{f.money(a.amount)}</Num></Td>
                      <Td>{a.pstatus === "voided" ? <Badge tone="danger">{t.common.voided}</Badge> : null}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Empty>{t.common.noData}</Empty>
            )}
          </Card>
          <Card title={t.dues.adjustments}>
            {adjustments.length ? (
              <ul className="divide-y divide-border text-sm">
                {adjustments.map((a) => (
                  <li key={a.id} className="py-2">
                    <div className={`flex justify-between gap-2 ${a.status === "voided" ? "text-muted line-through" : ""}`}>
                      <span>{t.dues.adjKinds[a.kind as keyof typeof t.dues.adjKinds]} · {f.date(a.adj_date)} · {a.reason}</span>
                      <Num>{f.money(a.amount)}</Num>
                    </div>
                    {canEdit && a.status === "active" ? (
                      <Disclosure label={t.common.void} tone="danger">
                        <ActionForm action={voidAdjustmentAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="adjustment_id" value={a.id} />
                          <Field label={t.common.voidReason}><Input name="reason" required /></Field>
                          <SubmitButton variant="danger">{t.common.voidConfirm}</SubmitButton>
                        </ActionForm>
                      </Disclosure>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{t.common.noData}</Empty>
            )}
            {canEdit && c.outstanding > 0 ? (
              <div className="mt-3">
                <Disclosure label={t.dues.adjust}>
                  <ActionForm action={adjustAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label={t.dues.kind}>
                        <Select name="kind">
                          <option value="waiver">{t.dues.adjKinds.waiver}</option>
                          <option value="discount">{t.dues.adjKinds.discount}</option>
                          <option value="correction">{t.dues.adjKinds.correction}</option>
                        </Select>
                      </Field>
                      <Field label={`${t.common.amount} (₪)`}><Input name="amount" inputMode="decimal" required dir="ltr" defaultValue={f.plain(c.outstanding)} /></Field>
                      <Field label={t.common.date}><Input name="date" type="date" defaultValue={d0} required /></Field>
                    </div>
                    <Field label={t.common.reason}><Input name="reason" required /></Field>
                    <SubmitButton>{t.common.save}</SubmitButton>
                  </ActionForm>
                </Disclosure>
              </div>
            ) : null}
          </Card>
        </div>
        {canEdit ? (
          <Disclosure label={t.dues.editCharge}>
            <ActionForm action={editChargeAction}>
              <input type="hidden" name="id" value={c.id} />
              <p className="text-sm text-muted">{t.dues.editChargeHelp}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`${t.common.amount} (₪)`}><Input name="amount" inputMode="decimal" required dir="ltr" defaultValue={f.plain(c.amount)} /></Field>
                <Field label={t.dues.dueDate}><Input name="due_date" type="date" required defaultValue={c.due_date} /></Field>
              </div>
              <Field label={t.common.description}><Input name="description" defaultValue={c.description} /></Field>
              <Field label={t.dues.reasonIfAmount}><Input name="reason" /></Field>
              <SubmitButton>{t.common.save}</SubmitButton>
            </ActionForm>
          </Disclosure>
        ) : null}
        {canEdit ? (
          <Disclosure label={t.dues.deleteCharge} tone="danger">
            <ActionForm action={voidChargeAction}>
              <input type="hidden" name="id" value={c.id} />
              <p className="text-sm text-muted">{t.dues.voidChargeHelp}</p>
              <Field label={t.common.voidReason}><Input name="reason" required /></Field>
              <SubmitButton variant="danger">{t.common.voidConfirm}</SubmitButton>
            </ActionForm>
          </Disclosure>
        ) : null}
      </div>
    </>
  );
}
