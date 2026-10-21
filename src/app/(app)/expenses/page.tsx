import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { today } from "@/lib/services/common";
import { listCategories } from "@/lib/services/setup";
import { monthStart } from "@/lib/core/dates";
import { Badge, Button, Card, Empty, Field, Input, LinkButton, Num, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { PlusIcon } from "@/components/icons";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; category?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const f = formatters(locale);
  const sql = db();
  const d0 = await today(sql);
  const sp = await searchParams;
  const from = sp.from || monthStart(d0);
  const to = sp.to || d0;
  const cat = sp.category || null;
  const cats = await listCategories(sql, true);
  const rows = await sql<
    { id: string; expense_date: string; amount: number; vendor: string; description: string; status: string; name_ar: string; name_en: string; attachment_path: string | null }[]
  >`
    select e.id, e.expense_date, e.amount, e.vendor, e.description, e.status, c.name_ar, c.name_en, e.attachment_path
    from expenses e join expense_categories c on c.id = e.category_id
    where e.expense_date between ${from} and ${to} and (${cat}::uuid is null or e.category_id = ${cat}::uuid)
    order by e.expense_date desc, e.created_at desc`;
  const total = rows.filter((r) => r.status === "active").reduce((s, r) => s + r.amount, 0);
  return (
    <>
      <PageHeader
        title={t.expenses.title}
        actions={can(user, "treasurer") ? <LinkButton href="/expenses/new"><PlusIcon className="size-4" />{t.expenses.new}</LinkButton> : null}
      />
      <Card>
        <form className="no-print mb-4 flex flex-wrap items-end gap-2">
          <Field label={t.common.from}><Input name="from" type="date" defaultValue={from} /></Field>
          <Field label={t.common.to}><Input name="to" type="date" defaultValue={to} /></Field>
          <Field label={t.expenses.category}>
            <Select name="category" defaultValue={cat ?? ""}>
              <option value="">{t.common.all}</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.name_ar : c.name_en || c.name_ar}</option>)}
            </Select>
          </Field>
          <Button type="submit" variant="secondary">{t.common.apply}</Button>
        </form>
        {rows.length ? (
          <Table>
            <thead>
              <tr><Th>{t.common.date}</Th><Th>{t.expenses.category}</Th><Th>{t.expenses.vendor}</Th><Th>{t.common.description}</Th><Th className="text-end">{t.common.amount}</Th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.status === "voided" ? "text-muted" : ""}>
                  <Td><Link className="text-primary" href={`/expenses/${r.id}`}>{f.date(r.expense_date)}</Link></Td>
                  <Td>{locale === "ar" ? r.name_ar : r.name_en || r.name_ar}</Td>
                  <Td>{r.vendor || t.common.none}</Td>
                  <Td className="max-w-72 truncate text-muted">
                    {r.description}
                    {r.status === "voided" ? <span className="ms-2"><Badge tone="danger">{t.common.voided}</Badge></span> : null}
                    {r.attachment_path ? <span className="ms-2"><Badge tone="info">{t.expenses.attachment}</Badge></span> : null}
                  </Td>
                  <Td className={`text-end font-medium ${r.status === "voided" ? "line-through" : ""}`}><Num>{f.money(r.amount)}</Num></Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold"><Td colSpan={4}>{t.common.total}</Td><Td className="text-end"><Num>{f.money(total)}</Num></Td></tr>
            </tfoot>
          </Table>
        ) : (
          <Empty>{t.common.noData}</Empty>
        )}
      </Card>
    </>
  );
}
