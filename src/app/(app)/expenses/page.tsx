import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { fmt, getDict } from "@/lib/i18n";
import { formatters } from "@/lib/format";
import { today } from "@/lib/services/common";
import { listCategories } from "@/lib/services/setup";
import { monthStart } from "@/lib/core/dates";
import { Badge, Card, Empty, Field, FilterBar, Input, LINK, LinkButton, Num, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { AttachmentIcon, PlusIcon, ReceiptIcon } from "@/components/icons";

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
  const filtered = !!(sp.from || sp.to || cat);
  return (
    <>
      <PageHeader
        title={t.expenses.title}
        subtitle={`${f.date(from)} – ${f.date(to)} · ${fmt(t.common.results, { n: rows.length })}`}
        actions={can(user, "treasurer") ? <LinkButton href="/expenses/new"><PlusIcon />{t.expenses.new}</LinkButton> : null}
      />
      <Card flush>
        <FilterBar apply={t.common.apply} reset={filtered ? { href: "/expenses", label: t.common.reset } : undefined}>
          <Field label={t.common.from} className="w-[calc(50%-0.375rem)] sm:w-40"><Input name="from" type="date" defaultValue={from} /></Field>
          <Field label={t.common.to} className="w-[calc(50%-0.375rem)] sm:w-40"><Input name="to" type="date" defaultValue={to} /></Field>
          <Field label={t.expenses.category} className="w-full sm:w-52">
            <Select name="category" defaultValue={cat ?? ""}>
              <option value="">{t.common.all}</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.name_ar : c.name_en || c.name_ar}</option>)}
            </Select>
          </Field>
        </FilterBar>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t.common.date}</Th>
                <Th>{t.expenses.category}</Th>
                <Th className="hidden sm:table-cell">{t.expenses.vendor}</Th>
                <Th className="hidden md:table-cell">{t.common.description}</Th>
                <Th className="text-end">{t.common.amount}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.status === "voided" ? "text-muted" : ""}>
                  <Td className="whitespace-nowrap"><Link className={LINK} href={`/expenses/${r.id}`}>{f.date(r.expense_date)}</Link></Td>
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      {locale === "ar" ? r.name_ar : r.name_en || r.name_ar}
                      {r.status === "voided" ? <Badge tone="danger">{t.common.voided}</Badge> : null}
                    </span>
                  </Td>
                  <Td className="hidden max-w-40 truncate text-text-2 sm:table-cell">{r.vendor || <span className="text-muted">{t.common.none}</span>}</Td>
                  <Td className="hidden max-w-72 md:table-cell">
                    <span className="flex items-center gap-2 text-muted">
                      <span className="truncate">{r.description}</span>
                      {r.attachment_path ? <AttachmentIcon className="size-3.5 shrink-0 text-primary" aria-label={t.expenses.attachment} /> : null}
                    </span>
                  </Td>
                  <Td className={`text-end font-medium ${r.status === "voided" ? "line-through" : ""}`}><Num>{f.money(r.amount)}</Num></Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <Td colSpan={2}>{t.common.total}</Td>
                <Td className="hidden sm:table-cell" />
                <Td className="hidden md:table-cell" />
                <Td className="text-end"><Num>{f.money(total)}</Num></Td>
              </tr>
            </tfoot>
          </Table>
        ) : (
          <Empty icon={<ReceiptIcon />}>{t.common.noData}</Empty>
        )}
      </Card>
    </>
  );
}
