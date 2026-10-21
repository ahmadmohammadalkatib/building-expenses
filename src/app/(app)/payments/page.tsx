import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { today } from "@/lib/services/common";
import { monthStart } from "@/lib/core/dates";
import { Badge, Button, Card, Empty, Field, Input, LinkButton, Num, PageHeader, Table, Td, Th } from "@/components/ui";
import { PlusIcon } from "@/components/icons";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; q?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const d0 = await today(sql);
  const sp = await searchParams;
  const from = sp.from || monthStart(d0);
  const to = sp.to || d0;
  const q = (sp.q ?? "").trim();
  const rows = await sql<
    { id: string; receipt_no: string | null; kind: string; payment_date: string; amount: number; method: string; payer_name: string; status: string; number: string; apartment_id: string }[]
  >`
    select p.id, p.receipt_no, p.kind, p.payment_date, p.amount, p.method, p.payer_name, p.status, a.number, a.id as apartment_id
    from payments p join apartments a on a.id = p.apartment_id
    where p.payment_date between ${from} and ${to}
      and (${q} = '' or a.number ilike ${"%" + q + "%"} or p.payer_name ilike ${"%" + q + "%"} or coalesce(p.receipt_no,'') ilike ${"%" + q + "%"})
    order by p.payment_date desc, p.created_at desc`;
  const total = rows.filter((r) => r.status === "active" && r.kind === "payment").reduce((s, r) => s + r.amount, 0);
  return (
    <>
      <PageHeader
        title={t.payments.title}
        actions={can(user, "treasurer") ? <LinkButton href="/payments/new"><PlusIcon className="size-4" />{t.payments.new}</LinkButton> : null}
      />
      <Card>
        <form className="no-print mb-4 flex flex-wrap items-end gap-2">
          <Field label={t.common.from}><Input name="from" type="date" defaultValue={from} /></Field>
          <Field label={t.common.to}><Input name="to" type="date" defaultValue={to} /></Field>
          <Field label={t.common.search}><Input name="q" defaultValue={q} /></Field>
          <Button type="submit" variant="secondary">{t.common.apply}</Button>
        </form>
        {rows.length ? (
          <Table>
            <thead>
              <tr><Th>{t.payments.receiptNo}</Th><Th>{t.common.date}</Th><Th>{t.common.apartment}</Th><Th>{t.payments.payer}</Th><Th>{t.common.method}</Th><Th className="text-end">{t.common.amount}</Th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.status === "voided" ? "text-muted" : ""}>
                  <Td>
                    <Link className="font-medium text-primary" href={`/payments/${r.id}`}><Num>{r.receipt_no ?? t.payments.openingCredit}</Num></Link>
                    {r.status === "voided" ? <span className="ms-2"><Badge tone="danger">{t.common.voided}</Badge></span> : null}
                  </Td>
                  <Td>{f.date(r.payment_date)}</Td>
                  <Td><Link className="text-primary" href={`/apartments/${r.apartment_id}`}>{r.number}</Link></Td>
                  <Td>{r.payer_name || t.common.none}</Td>
                  <Td>{t.methods[r.method as keyof typeof t.methods]}</Td>
                  <Td className={`text-end font-medium ${r.status === "voided" ? "line-through" : ""}`}><Num>{f.money(r.amount)}</Num></Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold"><Td colSpan={5}>{t.common.total}</Td><Td className="text-end"><Num>{f.money(total)}</Num></Td></tr>
            </tfoot>
          </Table>
        ) : (
          <Empty>{t.common.noData}</Empty>
        )}
      </Card>
    </>
  );
}
