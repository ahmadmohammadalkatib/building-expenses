import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { fmt, getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { today } from "@/lib/services/common";
import { apartmentDetail, apartmentStatement, chargeList } from "@/lib/services/reports";
import { whatsappLink } from "@/lib/core/phone";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Dialog } from "@/components/dialog";
import { Alert, Badge, Card, Empty, Field, Input, LINK, LinkButton, Num, PageHeader, Stat, Table, Td, Th } from "@/components/ui";
import { ChargeStatus } from "@/components/status";
import {
  ArchiveIcon,
  DuesIcon,
  EditIcon,
  MailIcon,
  MessageIcon,
  PhoneIcon,
  PlusIcon,
  PrintIcon,
  UnarchiveIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";
import { apartmentDeletable } from "@/lib/services/setup";
import { archiveAction, changeOwnerAction, updateOwnerAction } from "../actions";
import { DeleteApartmentDialog, EditApartmentDialog } from "../apartment-dialogs";

export default async function ApartmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { edit } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const d0 = await today(sql);
  const [detail, statement, charges, deletable] = await Promise.all([
    apartmentDetail(sql, id),
    apartmentStatement(sql, id),
    chargeList(sql, { apartmentId: id }, d0),
    apartmentDeletable(sql, id),
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
        back={{ href: "/apartments", label: t.apartments.title }}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {`${t.common.apartment} ${apt.number}`}
            {apt.archived_at ? <Badge>{t.common.archived} · {f.date(apt.archived_at)}</Badge> : null}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {apt.floor !== null ? <span>{t.common.floor} {apt.floor}</span> : null}
            {apt.floor !== null ? <span aria-hidden>·</span> : null}
            <span>{t.apartments.billingStart}: {f.month(apt.billing_start_month)}</span>
          </span>
        }
        actions={
          canEdit ? (
            <>
              {reminder ? (
                <LinkButton href={reminder} target="_blank" variant="secondary"><MessageIcon />{t.apartments.remind}</LinkButton>
              ) : null}
              <EditApartmentDialog t={t} apt={apt} defaultOpen={edit === "1"} />
              <LinkButton href={`/dues/new?apartment=${apt.id}`} variant="secondary"><PlusIcon />{t.apartments.addCharge}</LinkButton>
              <LinkButton href={`/payments/new?apartment=${apt.id}`}><WalletIcon />{t.apartments.recordPayment}</LinkButton>
            </>
          ) : null
        }
      />

      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label={t.apartments.outstanding}
            icon={<DuesIcon />}
            value={<Num>{f.money(detail.outstanding)}</Num>}
            tone={detail.outstanding > 0 ? "danger" : undefined}
          />
          <Stat
            label={t.apartments.credit}
            icon={<WalletIcon />}
            value={<Num>{f.money(detail.credit)}</Num>}
            tone={detail.credit > 0 ? "success" : undefined}
          />
          <div className="rounded-xl border border-border bg-surface p-4 shadow-xs sm:col-span-2 sm:p-5 lg:col-span-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.8125rem] font-medium text-muted">{t.apartments.ownerSection}</span>
              <span className="no-print grid size-8 place-items-center rounded-lg bg-surface-2 text-text-2"><UserIcon className="size-4" aria-hidden /></span>
            </div>
            {owner ? (
              <div className="mt-2 space-y-1">
                <div className="text-base font-semibold">{owner.full_name}</div>
                {owner.phone ? (
                  <a className="flex items-center gap-1.5 text-sm text-text-2 hover:text-primary" href={whatsappLink(owner.phone)} target="_blank" rel="noreferrer">
                    <PhoneIcon className="size-3.5 text-muted" aria-hidden /><Num>{owner.phone}</Num>
                  </a>
                ) : null}
                {owner.email ? (
                  <div className="flex items-center gap-1.5 text-sm text-text-2">
                    <MailIcon className="size-3.5 text-muted" aria-hidden /><span dir="ltr" className="truncate">{owner.email}</span>
                  </div>
                ) : null}
                <div className="text-xs text-muted">{t.apartments.ownerSince} {f.date(owner.start_date)}</div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted">{t.apartments.noOwner}</div>
            )}
          </div>
        </div>

        <Card
          title={t.apartments.statement}
          flush
          actions={
            <LinkButton href={`/reports/statement?apartment=${apt.id}`} variant="ghost" size="sm"><PrintIcon />{t.common.print}</LinkButton>
          }
        >
          {statement.lines.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t.common.date}</Th>
                  <Th>{t.dues.kind}</Th>
                  <Th className="hidden md:table-cell">{t.common.description}</Th>
                  <Th className="text-end">{t.dues.title}</Th>
                  <Th className="text-end">{t.payments.title}</Th>
                  <Th className="text-end">{t.apartments.balance}</Th>
                </tr>
              </thead>
              <tbody>
                {statement.lines.map((l) => (
                  <tr key={l.type + l.id}>
                    <Td className="whitespace-nowrap text-muted">{l.type === "charge" ? f.month(l.date) : f.date(l.date)}</Td>
                    <Td>
                      {l.type === "adjustment" ? (
                        <span className="text-text-2">{typeLabel(l.type, l.kind)}</span>
                      ) : (
                        <Link className={LINK} href={l.type === "charge" ? `/dues/${l.id}` : `/payments/${l.id}`}>{typeLabel(l.type, l.kind)}</Link>
                      )}
                    </Td>
                    <Td className="hidden max-w-64 truncate text-muted md:table-cell">{l.ref ? <Num>{l.ref}</Num> : null} {l.description}</Td>
                    <Td className="text-end">{l.debit ? <Num>{f.money(l.debit)}</Num> : ""}</Td>
                    <Td className="text-end text-success">{l.credit ? <Num>{f.money(l.credit)}</Num> : ""}</Td>
                    <Td className={`whitespace-nowrap text-end font-medium ${l.balance > 0 ? "text-danger" : l.balance < 0 ? "text-success" : ""}`}>
                      <Num>{f.money(Math.abs(l.balance))}</Num>{" "}
                      <span className="text-xs font-normal">{l.balance > 0 ? t.apartments.owes : l.balance < 0 ? t.apartments.inCredit : ""}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty>{t.common.noData}</Empty>
          )}
        </Card>

        <Card title={t.dues.title} flush>
          {charges.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t.dues.billingMonth}</Th>
                  <Th className="hidden sm:table-cell">{t.dues.kind}</Th>
                  <Th className="text-end">{t.common.amount}</Th>
                  <Th className="text-end">{t.dues.outstanding}</Th>
                  <Th>{t.common.status}</Th>
                </tr>
              </thead>
              <tbody>
                {charges.map((c) => (
                  <tr key={c.id} className={c.status === "voided" ? "text-muted" : ""}>
                    <Td><Link className={LINK} href={`/dues/${c.id}`}>{f.month(c.billing_month)}</Link></Td>
                    <Td className="hidden text-text-2 sm:table-cell">{t.dues.kinds[c.kind as keyof typeof t.dues.kinds]}</Td>
                    <Td className="text-end"><Num>{f.money(c.amount)}</Num></Td>
                    <Td className="text-end font-medium"><Num>{f.money(c.outstanding)}</Num></Td>
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
          <div className="no-print grid gap-6 lg:grid-cols-2">
            <Card title={t.apartments.manage}>
              <div className="divide-y divide-border">
                <ActionForm action={archiveAction} className="pb-5">
                  <input type="hidden" name="id" value={apt.id} />
                  <input type="hidden" name="archive" value={apt.archived_at ? "0" : "1"} />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium">{apt.archived_at ? t.apartments.unarchive : t.apartments.archive}</div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted">{t.apartments.archiveHelp}</p>
                    </div>
                    <SubmitButton variant="secondary">
                      {apt.archived_at ? <UnarchiveIcon /> : <ArchiveIcon />}
                      {apt.archived_at ? t.apartments.unarchive : t.apartments.archive}
                    </SubmitButton>
                  </div>
                </ActionForm>
                <div className="pt-5">
                  {deletable ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-medium text-danger">{t.apartments.delete}</div>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">{t.apartments.deleteHelp}</p>
                      </div>
                      <DeleteApartmentDialog t={t} id={apt.id} number={apt.number} />
                    </div>
                  ) : (
                    <Alert tone="neutral" title={t.apartments.delete}>{t.apartments.deleteBlocked}</Alert>
                  )}
                </div>
              </div>
            </Card>
            <Card
              title={t.apartments.ownershipHistory}
              actions={
                <>
                  {owner ? (
                    <Dialog label={t.apartments.editOwner} icon={<EditIcon />} variant="ghost" size="sm" title={t.apartments.editOwner} closeLabel={t.common.close}>
                      <ActionForm action={updateOwnerAction}>
                        <input type="hidden" name="id" value={apt.id} />
                        <input type="hidden" name="owner_id" value={owner.owner_id} />
                        <Field label={t.apartments.ownerName}><Input name="owner_name" defaultValue={owner.full_name} required /></Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label={t.apartments.ownerPhone}><Input name="owner_phone" type="tel" defaultValue={owner.phone ?? ""} dir="ltr" /></Field>
                          <Field label={t.apartments.ownerEmail}><Input name="owner_email" type="email" defaultValue={owner.email ?? ""} dir="ltr" /></Field>
                        </div>
                        <div className="flex justify-end"><SubmitButton>{t.common.save}</SubmitButton></div>
                      </ActionForm>
                    </Dialog>
                  ) : null}
                </>
              }
            >
              {owners.length ? (
                <ol className="mb-5 space-y-3">
                  {owners.map((o) => (
                    <li key={o.owner_id + o.start_date} className="flex items-start gap-3">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${o.end_date ? "bg-border-strong" : "bg-primary"}`} aria-hidden />
                      <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="text-sm font-medium">{o.full_name}</span>
                        <span className="text-xs text-muted">{f.date(o.start_date)} – {o.end_date ? f.date(o.end_date) : "…"}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mb-5 text-sm text-muted">{t.apartments.noOwner}</p>
              )}
              <Dialog label={t.apartments.changeOwner} icon={<UsersIcon />} title={t.apartments.changeOwner} closeLabel={t.common.close}>
                <ActionForm action={changeOwnerAction}>
                  <input type="hidden" name="id" value={apt.id} />
                  <Field label={t.apartments.ownerName}><Input name="owner_name" required /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t.apartments.ownerPhone}><Input name="owner_phone" type="tel" dir="ltr" /></Field>
                    <Field label={t.apartments.ownerEmail}><Input name="owner_email" type="email" dir="ltr" /></Field>
                  </div>
                  <Field label={t.apartments.ownerSince}><Input name="start_date" type="date" defaultValue={d0} required /></Field>
                  <div className="flex justify-end"><SubmitButton>{t.common.save}</SubmitButton></div>
                </ActionForm>
              </Dialog>
            </Card>
          </div>
        ) : null}
      </div>
    </>
  );
}
