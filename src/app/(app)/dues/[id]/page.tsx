import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { today } from "@/lib/services/common";
import { chargeState } from "@/lib/core/accounting";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Dialog } from "@/components/dialog";
import { Alert, Badge, Card, Empty, Field, Input, LINK, Num, PageHeader, Select, Stat, Table, Td, Th } from "@/components/ui";
import { ChargeStatus } from "@/components/status";
import { EditIcon, PlusIcon, VoidIcon } from "@/components/icons";
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
        back={{ href: "/dues", label: t.dues.title }}
        title={`${t.dues.kinds[c.kind as keyof typeof t.dues.kinds]} — ${f.month(c.billing_month)}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Link className={LINK} href={`/apartments/${c.apartment_id}`}>{t.common.apartment} {c.number}</Link>
            <span aria-hidden>·</span>
            <span>{t.dues.dueDate}: {f.date(c.due_date)}</span>
            <ChargeStatus t={t} state={state} voided={c.status === "voided"} />
          </span>
        }
        actions={
          canEdit ? (
            <>
              <Dialog label={t.dues.deleteCharge} icon={<VoidIcon />} variant="dangerSoft" tone="danger" title={t.dues.deleteCharge} description={t.dues.voidChargeHelp} closeLabel={t.common.close}>
                <ActionForm action={voidChargeAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <Field label={t.common.voidReason}><Input name="reason" required /></Field>
                  <div className="flex justify-end"><SubmitButton variant="danger">{t.common.voidConfirm}</SubmitButton></div>
                </ActionForm>
              </Dialog>
              <Dialog label={t.dues.editCharge} icon={<EditIcon />} title={t.dues.editCharge} description={t.dues.editChargeHelp} closeLabel={t.common.close}>
                <ActionForm action={editChargeAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={`${t.common.amount} (₪)`}><Input name="amount" inputMode="decimal" required dir="ltr" defaultValue={f.plain(c.amount)} /></Field>
                    <Field label={t.dues.dueDate}><Input name="due_date" type="date" required defaultValue={c.due_date} /></Field>
                  </div>
                  <Field label={t.common.description}><Input name="description" defaultValue={c.description} /></Field>
                  <Field label={t.dues.reasonIfAmount}><Input name="reason" /></Field>
                  <div className="flex justify-end"><SubmitButton>{t.common.save}</SubmitButton></div>
                </ActionForm>
              </Dialog>
            </>
          ) : null
        }
      />
      <div className="space-y-6">
        {c.status === "voided" ? <Alert tone="danger" title={t.common.voided}>{c.void_reason}</Alert> : null}
        {c.description ? <p className="text-sm text-text-2">{c.description}</p> : null}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={t.common.amount} value={<Num>{f.money(c.amount)}</Num>} />
          <Stat label={t.dues.paid} value={<Num>{f.money(c.paid)}</Num>} />
          <Stat label={t.dues.adjusted} value={<Num>{f.money(c.adjusted)}</Num>} />
          <Stat label={t.dues.outstanding} value={<Num>{f.money(c.outstanding)}</Num>} tone={c.outstanding > 0 ? "danger" : "success"} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t.dues.allocations} flush>
            {allocations.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>{t.payments.receiptNo}</Th>
                    <Th>{t.common.date}</Th>
                    <Th className="text-end">{t.common.amount}</Th>
                    <Th><span className="sr-only">{t.common.status}</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a) => (
                    <tr key={a.id} className={a.released_at || a.pstatus === "voided" ? "text-muted line-through" : ""}>
                      <Td><Link className={LINK} href={`/payments/${a.payment_id}`}><Num>{a.receipt_no ?? t.payments.openingCredit}</Num></Link></Td>
                      <Td className="text-text-2">{f.date(a.effective_date)}</Td>
                      <Td className="text-end"><Num>{f.money(a.amount)}</Num></Td>
                      <Td className="text-end">{a.pstatus === "voided" ? <Badge tone="danger">{t.common.voided}</Badge> : null}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Empty>{t.common.noData}</Empty>
            )}
          </Card>
          <Card
            title={t.dues.adjustments}
            flush
            actions={
              canEdit && c.outstanding > 0 ? (
                <Dialog label={t.dues.adjust} icon={<PlusIcon />} variant="ghost" size="sm" title={t.dues.adjust} closeLabel={t.common.close}>
                  <ActionForm action={adjustAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <div className="grid gap-4 sm:grid-cols-3">
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
                    <div className="flex justify-end"><SubmitButton>{t.common.save}</SubmitButton></div>
                  </ActionForm>
                </Dialog>
              ) : null
            }
          >
            {adjustments.length ? (
              <ul className="divide-y divide-border">
                {adjustments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
                    <div className={`min-w-0 flex-1 ${a.status === "voided" ? "text-muted line-through" : ""}`}>
                      <div className="font-medium">{t.dues.adjKinds[a.kind as keyof typeof t.dues.adjKinds]}</div>
                      <div className="truncate text-xs text-muted">{f.date(a.adj_date)} · {a.reason}</div>
                    </div>
                    <Num className={`shrink-0 font-medium ${a.status === "voided" ? "text-muted line-through" : ""}`}>{f.money(a.amount)}</Num>
                    {canEdit && a.status === "active" ? (
                      <Dialog label={<span className="sr-only sm:not-sr-only">{t.common.void}</span>} icon={<VoidIcon />} variant="dangerSoft" size="sm" tone="danger" title={t.common.void} description={t.common.voidHelp} closeLabel={t.common.close}>
                        <ActionForm action={voidAdjustmentAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="adjustment_id" value={a.id} />
                          <Field label={t.common.voidReason}><Input name="reason" required /></Field>
                          <div className="flex justify-end"><SubmitButton variant="danger">{t.common.voidConfirm}</SubmitButton></div>
                        </ActionForm>
                      </Dialog>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{t.common.noData}</Empty>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
