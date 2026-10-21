import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { fmt, getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { today } from "@/lib/services/common";
import { apartmentDetail, apartmentStatement, chargeList } from "@/lib/services/reports";
import { whatsappLink } from "@/lib/core/phone";
import { ActionForm, Disclosure, SubmitButton } from "@/components/forms";
import { Badge, Card, Empty, Field, Input, LinkButton, Num, PageHeader, Stat, Table, Td, Textarea, Th } from "@/components/ui";
import { ChargeStatus } from "@/components/status";
import { archiveAction, changeOwnerAction, updateApartmentAction, updateOwnerAction } from "../actions";

export default async function ApartmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const d0 = await today(sql);
  const [detail, statement, charges] = await Promise.all([
    apartmentDetail(sql, id),
    apartmentStatement(sql, id),
    chargeList(sql, { apartmentId: id }, d0),
  ]);
  if (!detail) notFound();
  const { apt, owner, owners } = detail;
  const canEdit = can(user, "treasurer");
  const reminder =
    owner?.phone && detail.outstanding > 0
      ? whatsappLink(owner.phone, fmt(t.apartments.reminderText, { name: owner.full_name, apt: apt.number, amount: f.money(detail.outstanding) }))
      : null;
  const typeLabel = (ty: string, kind?: string) =>
    ty === "charge" ? t.dues.kinds[(kind ?? "other") as keyof typeof t.dues.kinds] : ty === "payment" ? t.dashboard.payment : ty === "opening_credit" ? t.payments.openingCredit : t.dues.adjKinds[(kind ?? "waiver") as keyof typeof t.dues.adjKinds];

  return (
    <>
      <PageHeader
        title={`${t.common.apartment} ${apt.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {apt.floor !== null ? <span>{t.common.floor} {apt.floor}</span> : null}
            <span>· {t.apartments.billingStart}: {f.month(apt.billing_start_month)}</span>
            {apt.archived_at ? <Badge>{t.common.archived} {f.date(apt.archived_at)}</Badge> : null}
          </span>
        }
        actions={
          canEdit ? (
            <>
              <LinkButton href={`/payments/new?apartment=${apt.id}`}>{t.apartments.recordPayment}</LinkButton>
              <LinkButton href={`/dues/new?apartment=${apt.id}`} variant="secondary">{t.apartments.addCharge}</LinkButton>
              {reminder ? <LinkButton href={reminder} target="_blank" variant="secondary">{t.apartments.remind}</LinkButton> : null}
            </>
          ) : null
        }
      />

      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label={t.apartments.outstanding} value={<Num>{f.money(detail.outstanding)}</Num>} tone={detail.outstanding > 0 ? "danger" : undefined} />
          <Stat label={t.apartments.credit} value={<Num>{f.money(detail.credit)}</Num>} tone={detail.credit > 0 ? "success" : undefined} />
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="text-sm text-muted">{t.apartments.ownerSection}</div>
            {owner ? (
              <>
                <div className="mt-1 font-semibold">{owner.full_name}</div>
                {owner.phone ? (
                  <a className="text-sm text-primary" href={whatsappLink(owner.phone)} target="_blank" rel="noreferrer"><Num>{owner.phone}</Num></a>
                ) : null}
                {owner.email ? <div className="text-sm text-muted" dir="ltr">{owner.email}</div> : null}
                <div className="text-xs text-muted">{t.apartments.ownerSince} {f.date(owner.start_date)}</div>
              </>
            ) : (
              <div className="mt-1 text-muted">{t.apartments.noOwner}</div>
            )}
          </div>
        </div>

        <Card
          title={t.apartments.statement}
          actions={<Link className="text-sm text-primary" href={`/reports/statement?apartment=${apt.id}`}>{t.common.print}</Link>}
        >
          {statement.lines.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t.common.date}</Th><Th>{t.dues.kind}</Th><Th>{t.common.description}</Th>
                  <Th className="text-end">{t.dues.title}</Th><Th className="text-end">{t.payments.title}</Th><Th className="text-end">{t.apartments.balance}</Th>
                </tr>
              </thead>
              <tbody>
                {statement.lines.map((l) => (
                  <tr key={l.type + l.id}>
                    <Td className="text-muted">{l.type === "charge" ? f.month(l.date) : f.date(l.date)}</Td>
                    <Td>
                      <Link className="text-primary" href={l.type === "charge" ? `/dues/${l.id}` : l.type === "adjustment" ? "#" : `/payments/${l.id}`}>
                        {typeLabel(l.type, l.kind)}
                      </Link>
                    </Td>
                    <Td className="max-w-64 truncate text-muted">{l.ref ? <Num>{l.ref}</Num> : null} {l.description}</Td>
                    <Td className="text-end">{l.debit ? <Num>{f.money(l.debit)}</Num> : ""}</Td>
                    <Td className="text-end text-success">{l.credit ? <Num>{f.money(l.credit)}</Num> : ""}</Td>
                    <Td className={`text-end font-medium ${l.balance > 0 ? "text-danger" : l.balance < 0 ? "text-success" : ""}`}><Num>{f.money(Math.abs(l.balance))}</Num> <span className="text-xs">{l.balance > 0 ? t.apartments.owes : l.balance < 0 ? t.apartments.inCredit : ""}</span></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty>{t.common.noData}</Empty>
          )}
        </Card>

        <Card title={t.dues.title}>
          {charges.length ? (
            <Table>
              <thead>
                <tr><Th>{t.dues.billingMonth}</Th><Th>{t.dues.kind}</Th><Th className="text-end">{t.common.amount}</Th><Th className="text-end">{t.dues.outstanding}</Th><Th>{t.common.status}</Th></tr>
              </thead>
              <tbody>
                {charges.map((c) => (
                  <tr key={c.id}>
                    <Td><Link className="text-primary" href={`/dues/${c.id}`}>{f.month(c.billing_month)}</Link></Td>
                    <Td>{t.dues.kinds[c.kind as keyof typeof t.dues.kinds]}</Td>
                    <Td className="text-end"><Num>{f.money(c.amount)}</Num></Td>
                    <Td className="text-end"><Num>{f.money(c.outstanding)}</Num></Td>
                    <Td><ChargeStatus t={t} voided={c.status === "voided"} state={c.state} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty>{t.common.noData}</Empty>
          )}
        </Card>

        {canEdit ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title={t.common.edit}>
              <ActionForm action={updateApartmentAction}>
                <input type="hidden" name="id" value={apt.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t.apartments.number}><Input name="number" defaultValue={apt.number} required /></Field>
                  <Field label={t.apartments.floor}><Input name="floor" type="number" defaultValue={apt.floor ?? ""} /></Field>
                  <Field label={t.apartments.billingStart} help={t.apartments.billingStartHelp}>
                    <Input name="billing_start" type="month" defaultValue={apt.billing_start_month.slice(0, 7)} required />
                  </Field>
                  <Field label={t.common.notes} className="sm:col-span-2"><Textarea name="notes" defaultValue={apt.notes} /></Field>
                </div>
                <SubmitButton>{t.common.save}</SubmitButton>
              </ActionForm>
              <div className="mt-4 border-t border-border pt-4">
                <ActionForm action={archiveAction}>
                  <input type="hidden" name="id" value={apt.id} />
                  <input type="hidden" name="archive" value={apt.archived_at ? "0" : "1"} />
                  <p className="text-xs text-muted">{t.apartments.archiveHelp}</p>
                  <SubmitButton variant="secondary">{apt.archived_at ? t.apartments.unarchive : t.apartments.archive}</SubmitButton>
                </ActionForm>
              </div>
            </Card>
            <Card title={t.apartments.ownershipHistory}>
              {owners.length ? (
                <ul className="mb-4 divide-y divide-border text-sm">
                  {owners.map((o) => (
                    <li key={o.owner_id + o.start_date} className="flex justify-between gap-2 py-2">
                      <span className="font-medium">{o.full_name}</span>
                      <span className="text-muted">{f.date(o.start_date)} – {o.end_date ? f.date(o.end_date) : "…"}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="space-y-2">
                {owner ? (
                  <Disclosure label={t.apartments.editOwner}>
                    <ActionForm action={updateOwnerAction}>
                      <input type="hidden" name="id" value={apt.id} />
                      <input type="hidden" name="owner_id" value={owner.owner_id} />
                      <Field label={t.apartments.ownerName}><Input name="owner_name" defaultValue={owner.full_name} required /></Field>
                      <Field label={t.apartments.ownerPhone}><Input name="owner_phone" type="tel" defaultValue={owner.phone ?? ""} dir="ltr" /></Field>
                      <Field label={t.apartments.ownerEmail}><Input name="owner_email" type="email" defaultValue={owner.email ?? ""} dir="ltr" /></Field>
                      <SubmitButton>{t.common.save}</SubmitButton>
                    </ActionForm>
                  </Disclosure>
                ) : null}
                <Disclosure label={t.apartments.changeOwner}>
                  <ActionForm action={changeOwnerAction}>
                    <input type="hidden" name="id" value={apt.id} />
                    <Field label={t.apartments.ownerName}><Input name="owner_name" required /></Field>
                    <Field label={t.apartments.ownerPhone}><Input name="owner_phone" type="tel" dir="ltr" /></Field>
                    <Field label={t.apartments.ownerEmail}><Input name="owner_email" type="email" dir="ltr" /></Field>
                    <Field label={t.apartments.ownerSince}><Input name="start_date" type="date" defaultValue={d0} required /></Field>
                    <SubmitButton>{t.common.save}</SubmitButton>
                  </ActionForm>
                </Disclosure>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </>
  );
}
