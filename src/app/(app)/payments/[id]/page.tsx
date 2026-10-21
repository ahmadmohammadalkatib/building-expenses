import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { fmt, getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { getSettings } from "@/lib/services/common";
import { ActionForm, Disclosure, SubmitButton } from "@/components/forms";
import { Alert, Field, Input, Num, PageHeader, Select, Textarea } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
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

  return (
    <>
      <PageHeader
        title={p.receipt_no ? `${t.payments.receipt} ${p.receipt_no}` : t.payments.openingCredit}
        actions={<><PrintButton label={t.common.print} /><Link href={`/apartments/${p.apartment_id}`} className="px-3 py-2 text-sm text-primary">{t.common.apartment} {p.number}</Link></>}
      />
      <div className="space-y-4">
        {isNew && p.receipt_no ? <div className="no-print"><Alert tone="success">{fmt(t.payments.recorded, { no: p.receipt_no })}</Alert></div> : null}
        {voided ? <div className="no-print"><Alert tone="danger">{t.common.voided}: {p.void_reason}</Alert></div> : null}

        {/* Printable receipt */}
        <article className="print-plain relative mx-auto max-w-2xl overflow-hidden rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          {voided ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="-rotate-12 rounded-lg border-4 border-danger px-6 py-2 text-5xl font-bold text-danger opacity-40">{t.payments.voidedStamp}</span>
            </div>
          ) : null}
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <div className="text-lg font-bold">{s.building_name || t.app.name}</div>
              {s.building_address ? <div className="text-sm text-muted">{s.building_address}</div> : null}
            </div>
            <div className="text-end">
              <div className="text-xl font-semibold">{p.kind === "payment" ? t.payments.receipt : t.payments.openingCredit}</div>
              {p.receipt_no ? <div className="num text-lg">{p.receipt_no}</div> : null}
              <div className="text-sm text-muted">{f.date(p.payment_date)}</div>
            </div>
          </header>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted">{t.payments.receivedFrom}</dt><dd className="font-medium">{p.payer_name || t.common.none}</dd>
            <dt className="text-muted">{t.payments.forApartment}</dt><dd className="font-medium">{p.number}</dd>
            <dt className="text-muted">{t.payments.theSum}</dt><dd className="text-xl font-bold"><Num>{f.money(p.amount)}</Num></dd>
            <dt className="text-muted">{t.common.method}</dt><dd>{t.methods[p.method as keyof typeof t.methods]}{p.reference ? <> · <Num>{p.reference}</Num></> : null}</dd>
            <dt className="text-muted">{t.payments.appliedTo}</dt>
            <dd>
              {live.length ? (
                <ul className="space-y-0.5">
                  {live.map((a, i) => (
                    <li key={i} className="flex justify-between gap-4">
                      <span>{t.dues.kinds[a.kind as keyof typeof t.dues.kinds]} — {f.month(a.billing_month)}</span>
                      <Num>{f.money(a.amount)}</Num>
                    </li>
                  ))}
                </ul>
              ) : t.common.none}
            </dd>
            {p.unallocated > 0 && !voided ? (
              <>
                <dt className="text-muted">{t.payments.creditLeft}</dt><dd><Num>{f.money(p.unallocated)}</Num></dd>
              </>
            ) : null}
            {p.notes ? (<><dt className="text-muted">{t.common.notes}</dt><dd>{p.notes}</dd></>) : null}
          </dl>
          <footer className="mt-10 flex items-end justify-between gap-4 text-sm">
            <div className="max-w-xs whitespace-pre-line text-xs text-muted">{s.receipt_footer}</div>
            <div className="text-center">
              <div className="mb-1 h-10 w-40 border-b border-border" />
              {t.payments.signature}
            </div>
          </footer>
        </article>

        {canEdit ? (
          <div className="no-print mx-auto flex max-w-2xl flex-col gap-2">
            <Disclosure label={t.payments.editDetails}>
              <ActionForm action={editPaymentAction}>
                <input type="hidden" name="id" value={p.id} />
                <p className="text-xs text-muted">{t.payments.editHelp}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t.payments.payer}><Input name="payer_name" defaultValue={p.payer_name} /></Field>
                  <Field label={t.common.method}>
                    <Select name="method" defaultValue={p.method}>
                      {Object.entries(t.methods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                  </Field>
                  <Field label={t.common.reference}><Input name="reference" defaultValue={p.reference} /></Field>
                </div>
                <Field label={t.common.notes}><Textarea name="notes" defaultValue={p.notes} /></Field>
                <SubmitButton>{t.common.save}</SubmitButton>
              </ActionForm>
            </Disclosure>
            <Disclosure label={t.common.void} tone="danger">
              <ActionForm action={voidPaymentAction}>
                <input type="hidden" name="id" value={p.id} />
                <p className="text-xs text-muted">{t.common.voidHelp}</p>
                <Field label={t.common.voidReason}><Input name="reason" required /></Field>
                <SubmitButton variant="danger">{t.common.voidConfirm}</SubmitButton>
              </ActionForm>
            </Disclosure>
          </div>
        ) : null}
        <p className="no-print text-center text-xs text-muted">
          {t.common.createdBy} {p.created_email ?? "system"} · {f.dateTime(p.created_at)}
        </p>
      </div>
    </>
  );
}
