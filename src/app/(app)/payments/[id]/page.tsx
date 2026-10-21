import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { fmt, getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { getSettings } from "@/lib/services/common";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Dialog } from "@/components/dialog";
import { Alert, Field, Input, LinkButton, Num, PageHeader, Select, Textarea } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { BuildingIcon, DoorIcon, EditIcon, VoidIcon } from "@/components/icons";
import { editPaymentAction, voidPaymentAction } from "../actions";

export default async function PaymentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const s = await getSettings(sql);
  const [p] = await sql<
    { id: string; receipt_no: string | null; kind: string; apartment_id: string; number: string; payer_name: string; amount: number; payment_date: string; method: string; reference: string; notes: string; status: string; void_reason: string | null; unallocated: number; created_at: string; created_email: string | null }[]
  >`
    select pb.*, a.number, u.email as created_email
    from payment_balances pb join apartments a on a.id = pb.apartment_id left join app_users u on u.id = pb.created_by
    where pb.id = ${id}`;
  if (!p) notFound();
  const allocs = await sql<{ charge_id: string; kind: string; billing_month: string; amount: number; released_at: string | null }[]>`
    select al.charge_id, c.kind, c.billing_month, al.amount, al.released_at
    from allocations al join charges c on c.id = al.charge_id where al.payment_id = ${id} order by c.billing_month, al.created_at`;
  const live = allocs.filter((a) => !a.released_at);
  const { new: isNew } = await searchParams;
  const voided = p.status === "voided";
  const canEdit = can(user, "treasurer") && !voided;
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-4 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-sm">{value}</dd>
    </div>
  );

  return (
    <>
      <PageHeader
        back={{ href: "/payments", label: t.payments.title }}
        title={p.receipt_no ? `${t.payments.receipt} ${p.receipt_no}` : t.payments.openingCredit}
        subtitle={f.date(p.payment_date)}
        actions={
          <>
            {canEdit ? (
              <>
                <Dialog label={t.common.void} icon={<VoidIcon />} variant="dangerSoft" tone="danger" title={t.common.void} description={t.common.voidHelp} closeLabel={t.common.close}>
                  <ActionForm action={voidPaymentAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <Field label={t.common.voidReason}><Input name="reason" required /></Field>
                    <div className="flex justify-end"><SubmitButton variant="danger">{t.common.voidConfirm}</SubmitButton></div>
                  </ActionForm>
                </Dialog>
                <Dialog label={t.payments.editDetails} icon={<EditIcon />} title={t.payments.editDetails} description={t.payments.editHelp} closeLabel={t.common.close}>
                  <ActionForm action={editPaymentAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t.payments.payer}><Input name="payer_name" defaultValue={p.payer_name} /></Field>
                      <Field label={t.common.method}>
                        <Select name="method" defaultValue={p.method}>
                          {Object.entries(t.methods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                      </Field>
                      <Field label={t.common.reference} className="sm:col-span-2"><Input name="reference" defaultValue={p.reference} /></Field>
                    </div>
                    <Field label={t.common.notes}><Textarea name="notes" defaultValue={p.notes} /></Field>
                    <div className="flex justify-end"><SubmitButton>{t.common.save}</SubmitButton></div>
                  </ActionForm>
                </Dialog>
              </>
            ) : null}
            <LinkButton href={`/apartments/${p.apartment_id}`} variant="secondary"><DoorIcon />{t.common.apartment} {p.number}</LinkButton>
            <PrintButton label={t.common.print} />
          </>
        }
      />
      <div className="mx-auto max-w-2xl space-y-4">
        {isNew && p.receipt_no ? <div className="no-print"><Alert tone="success">{fmt(t.payments.recorded, { no: p.receipt_no })}</Alert></div> : null}
        {voided ? <div className="no-print"><Alert tone="danger" title={t.common.voided}>{p.void_reason}</Alert></div> : null}

        {/* Printable receipt */}
        <article className="print-plain relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {voided ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <span className="-rotate-12 rounded-xl border-4 border-danger px-6 py-2 text-5xl font-bold tracking-wide text-danger opacity-35">{t.payments.voidedStamp}</span>
            </div>
          ) : null}
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-ink">
                <BuildingIcon className="size-5" aria-hidden />
              </span>
              <div>
                <div className="text-base font-semibold">{s.building_name || t.app.name}</div>
                {s.building_address ? <div className="text-sm text-muted">{s.building_address}</div> : null}
              </div>
            </div>
            <div className="text-end">
              <div className="text-xs font-medium text-muted">{p.kind === "payment" ? t.payments.receipt : t.payments.openingCredit}</div>
              {p.receipt_no ? <div className="num text-lg font-semibold">{p.receipt_no}</div> : null}
              <div className="text-sm text-muted">{f.date(p.payment_date)}</div>
            </div>
          </header>
          <div className="p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-surface-2 px-5 py-4">
              <span className="text-sm text-muted">{t.payments.theSum}</span>
              <Num className={`text-3xl font-semibold tracking-tight ${voided ? "text-muted line-through" : ""}`}>{f.money(p.amount)}</Num>
            </div>
            <dl className="divide-y divide-border">
              {row(t.payments.receivedFrom, <span className="font-medium">{p.payer_name || t.common.none}</span>)}
              {row(t.payments.forApartment, <span className="font-medium">{p.number}</span>)}
              {row(
                t.common.method,
                <>
                  {t.methods[p.method as keyof typeof t.methods]}
                  {p.reference ? <> · <Num>{p.reference}</Num></> : null}
                </>,
              )}
              {row(
                t.payments.appliedTo,
                live.length ? (
                  <ul className="space-y-1">
                    {live.map((a, i) => (
                      <li key={i} className="flex justify-between gap-4">
                        <span>{t.dues.kinds[a.kind as keyof typeof t.dues.kinds]} — {f.month(a.billing_month)}</span>
                        <Num>{f.money(a.amount)}</Num>
                      </li>
                    ))}
                  </ul>
                ) : (
                  t.common.none
                ),
              )}
              {p.unallocated > 0 && !voided ? row(t.payments.creditLeft, <Num className="font-medium text-success">{f.money(p.unallocated)}</Num>) : null}
              {p.notes ? row(t.common.notes, <span className="whitespace-pre-line">{p.notes}</span>) : null}
            </dl>
          </div>
          <footer className="flex flex-wrap items-end justify-between gap-6 border-t border-border p-6 text-sm sm:p-8">
            <div className="max-w-xs whitespace-pre-line text-xs leading-relaxed text-muted">{s.receipt_footer}</div>
            <div className="text-center text-muted">
              <div className="mb-1.5 h-10 w-44 border-b border-border-strong" />
              {t.payments.signature}
            </div>
          </footer>
        </article>

        <p className="no-print text-center text-xs text-muted">
          {t.common.createdBy} <span dir="ltr">{p.created_email ?? "system"}</span> · {f.dateTime(p.created_at)}
        </p>
      </div>
    </>
  );
}
