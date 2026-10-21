import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { fmt, getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { today } from "@/lib/services/common";
import { monthStart } from "@/lib/core/dates";
import { Badge, Card, Empty, Field, FilterBar, Input, LINK, LinkButton, Num, PageHeader, SearchInput, Table, Td, Th } from "@/components/ui";
import { PlusIcon, WalletIcon } from "@/components/icons";

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
  const filtered = !!(sp.from || sp.to || q);
  return (
    <>
      <PageHeader
        title={t.payments.title}
        subtitle={`${f.date(from)} – ${f.date(to)} · ${fmt(t.common.results, { n: rows.length })}`}
        actions={can(user, "treasurer") ? <LinkButton href="/payments/new"><PlusIcon />{t.payments.new}</LinkButton> : null}
      />
      <Card flush>
        <FilterBar apply={t.common.apply} reset={filtered ? { href: "/payments", label: t.common.reset } : undefined}>
          <Field label={t.common.from} className="w-[calc(50%-0.375rem)] sm:w-40"><Input name="from" type="date" defaultValue={from} /></Field>
          <Field label={t.common.to} className="w-[calc(50%-0.375rem)] sm:w-40"><Input name="to" type="date" defaultValue={to} /></Field>
          <Field label={t.common.search} className="w-full sm:w-60"><SearchInput name="q" defaultValue={q} /></Field>
        </FilterBar>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t.payments.receiptNo}</Th>
                <Th>{t.common.date}</Th>
                <Th>{t.common.apartment}</Th>
                <Th className="hidden md:table-cell">{t.payments.payer}</Th>
                <Th className="hidden sm:table-cell">{t.common.method}</Th>
                <Th className="text-end">{t.common.amount}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.status === "voided" ? "text-muted" : ""}>
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      <Link className={LINK} href={`/payments/${r.id}`}><Num>{r.receipt_no ?? t.payments.openingCredit}</Num></Link>
                      {r.status === "voided" ? <Badge tone="danger">{t.common.voided}</Badge> : null}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-text-2">{f.date(r.payment_date)}</Td>
                  <Td><Link className="text-text-2 underline-offset-4 hover:text-primary hover:underline" href={`/apartments/${r.apartment_id}`}>{r.number}</Link></Td>
                  <Td className="hidden max-w-48 truncate md:table-cell">{r.payer_name || <span className="text-muted">{t.common.none}</span>}</Td>
                  <Td className="hidden sm:table-cell"><Badge>{t.methods[r.method as keyof typeof t.methods]}</Badge></Td>
                  <Td className={`text-end font-medium ${r.status === "voided" ? "line-through" : ""}`}><Num>{f.money(r.amount)}</Num></Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <Td colSpan={3}>{t.common.total}</Td>
                <Td className="hidden md:table-cell" />
                <Td className="hidden sm:table-cell" />
                <Td className="text-end"><Num>{f.money(total)}</Num></Td>
              </tr>
            </tfoot>
          </Table>
        ) : (
          <Empty icon={<WalletIcon />}>{t.common.noData}</Empty>
        )}
      </Card>
    </>
  );
}
