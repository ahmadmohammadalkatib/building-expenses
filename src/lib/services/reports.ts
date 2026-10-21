// Read-side queries: dashboard and reports. Cash and dues are always computed separately.

import type { Db } from "@/lib/db/client";
import { addMonths, daysBetween, monthEnd, monthStart } from "@/lib/core/dates";
import { agingBucket, chargeState, type AgingBucket } from "@/lib/core/accounting";
import { getSettings } from "./common";

// ------------------------------------------------------------------ building blocks

export async function cashBalance(sql: Db, asOf: string): Promise<number> {
  const s = await getSettings(sql);
  const [r] = await sql<{ b: number }[]>`
    select (${s.opening_balance}::bigint
      + coalesce((select sum(amount) from payments where status = 'active' and kind = 'payment' and payment_date <= ${asOf}), 0)
      - coalesce((select sum(amount) from expenses where status = 'active' and expense_date <= ${asOf}), 0))::bigint as b`;
  return r.b;
}

/** Dues outstanding per apartment as of a date (uses allocation/adjustment effective dates). */
export async function outstandingByApartment(sql: Db, asOf: string) {
  return sql<{ apartment_id: string; outstanding: number }[]>`
    select c.apartment_id,
           sum(greatest(c.amount - coalesce(a.paid, 0) - coalesce(j.adj, 0), 0))::bigint as outstanding
    from charges c
    left join (
      select al.charge_id, sum(al.amount) as paid
      from allocations al join payments p on p.id = al.payment_id
      where p.status = 'active' and al.released_at is null and al.effective_date <= ${asOf}
      group by al.charge_id
    ) a on a.charge_id = c.id
    left join (
      select charge_id, sum(amount) as adj from adjustments
      where status = 'active' and adj_date <= ${asOf} group by charge_id
    ) j on j.charge_id = c.id
    where c.status = 'active' and c.billing_month <= ${asOf}
    group by c.apartment_id`;
}

export async function duesOutstanding(sql: Db, asOf: string): Promise<number> {
  const rows = await outstandingByApartment(sql, asOf);
  return rows.reduce((s, r) => s + r.outstanding, 0);
}

/** Unapplied credit (prepayments) held for apartments as of a date. */
export async function creditHeld(sql: Db, asOf: string): Promise<number> {
  const [r] = await sql<{ c: number }[]>`
    select coalesce(sum(p.amount - coalesce(a.alloc, 0)), 0)::bigint as c
    from payments p
    left join (
      select payment_id, sum(amount) as alloc from allocations
      where released_at is null and effective_date <= ${asOf} group by payment_id
    ) a on a.payment_id = p.id
    where p.status = 'active' and p.payment_date <= ${asOf}`;
  return r.c;
}

// ------------------------------------------------------------------ dashboard

export async function dashboard(sql: Db, today: string) {
  const m = monthStart(today);
  const from6 = addMonths(m, -5);
  const [cash, dues, credit] = await Promise.all([cashBalance(sql, today), duesOutstanding(sql, today), creditHeld(sql, today)]);
  const [month] = await sql<{ collected: number; spent: number; billed: number }[]>`
    select
      coalesce((select sum(amount) from payments where status = 'active' and kind = 'payment'
                and payment_date between ${m} and ${today}), 0)::bigint as collected,
      coalesce((select sum(amount) from expenses where status = 'active'
                and expense_date between ${m} and ${today}), 0)::bigint as spent,
      coalesce((select sum(amount) from charges where status = 'active' and billing_month = ${m}), 0)::bigint as billed`;
  const series = await sql<{ month: string; collections: number; expenses: number }[]>`
    with months as (select generate_series(${from6}::date, ${m}::date, interval '1 month')::date as month)
    select to_char(mo.month, 'YYYY-MM-DD') as month,
      coalesce((select sum(amount) from payments where status = 'active' and kind = 'payment'
                and date_trunc('month', payment_date) = mo.month), 0)::bigint as collections,
      coalesce((select sum(amount) from expenses where status = 'active'
                and date_trunc('month', expense_date) = mo.month), 0)::bigint as expenses
    from months mo order by mo.month`;
  const categories = await sql<{ name_ar: string; name_en: string; total: number }[]>`
    select c.name_ar, c.name_en, sum(e.amount)::bigint as total
    from expenses e join expense_categories c on c.id = e.category_id
    where e.status = 'active' and e.expense_date between ${from6} and ${today}
    group by c.id, c.name_ar, c.name_en order by total desc`;
  const debtors = await sql<
    { id: string; number: string; owner_name: string | null; phone: string | null; outstanding: number; oldest_due: string }[]
  >`
    select a.id, a.number, o.full_name as owner_name, o.phone, sum(cb.outstanding)::bigint as outstanding,
           min(cb.due_date) as oldest_due
    from charge_balances cb
    join apartments a on a.id = cb.apartment_id
    left join apartment_owners ao on ao.apartment_id = a.id and ao.end_date is null
    left join owners o on o.id = ao.owner_id
    where cb.status = 'active' and cb.outstanding > 0
    group by a.id, a.number, o.full_name, o.phone
    order by outstanding desc limit 5`;
  const recent = await sql<
    { kind: string; id: string; date: string; amount: number; label: string; status: string; created_at: string }[]
  >`
    (select 'payment' as kind, p.id, p.payment_date as date, p.amount, a.number as label, p.status, p.created_at
       from payments p join apartments a on a.id = p.apartment_id where p.kind = 'payment')
    union all
    (select 'expense', e.id, e.expense_date, e.amount, coalesce(nullif(e.vendor, ''), c.name_ar), e.status, e.created_at
       from expenses e join expense_categories c on c.id = e.category_id)
    order by created_at desc limit 8`;
  const [counts] = await sql<{ apartments: number; unpaid_this_month: number }[]>`
    select (select count(*) from apartments where archived_at is null)::int as apartments,
           (select count(distinct apartment_id) from charge_balances
             where status = 'active' and billing_month = ${m} and outstanding > 0)::int as unpaid_this_month`;
  return { cash, dues, credit, month, series, categories, debtors, recent, counts };
}

// ------------------------------------------------------------------ 1. monthly summary

export async function monthlySummary(sql: Db, month: string) {
  const m = monthStart(month);
  const end = monthEnd(m);
  const dayBefore = new Date(`${m}T00:00:00Z`);
  dayBefore.setUTCDate(0);
  const prev = dayBefore.toISOString().slice(0, 10);
  const s = await getSettings(sql);
  const [cashOpen, cashClose, duesOpen, duesClose, creditClose] = await Promise.all([
    cashBalance(sql, prev),
    cashBalance(sql, end),
    duesOutstanding(sql, prev),
    duesOutstanding(sql, end),
    creditHeld(sql, end),
  ]);
  const [flows] = await sql<{ collections: number; expenses: number; billed: number; allocated: number; adjusted: number }[]>`
    select
      coalesce((select sum(amount) from payments where status = 'active' and kind = 'payment'
                and payment_date between ${m} and ${end}), 0)::bigint as collections,
      coalesce((select sum(amount) from expenses where status = 'active'
                and expense_date between ${m} and ${end}), 0)::bigint as expenses,
      coalesce((select sum(amount) from charges where status = 'active' and billing_month = ${m}), 0)::bigint as billed,
      coalesce((select sum(al.amount) from allocations al join payments p on p.id = al.payment_id
                where p.status = 'active' and al.released_at is null
                and al.effective_date between ${m} and ${end}), 0)::bigint as allocated,
      coalesce((select sum(amount) from adjustments where status = 'active'
                and adj_date between ${m} and ${end}), 0)::bigint as adjusted`;
  const byCategory = await sql<{ name_ar: string; name_en: string; total: number }[]>`
    select c.name_ar, c.name_en, sum(e.amount)::bigint as total
    from expenses e join expense_categories c on c.id = e.category_id
    where e.status = 'active' and e.expense_date between ${m} and ${end}
    group by c.id, c.name_ar, c.name_en order by total desc`;
  const beforeOpening = s.opening_date ? end < s.opening_date : false;
  return {
    month: m,
    beforeOpening,
    cash: { opening: cashOpen, collections: flows.collections, expenses: flows.expenses, closing: cashClose },
    dues: { opening: duesOpen, billed: flows.billed, collected: flows.allocated, adjusted: flows.adjusted, closing: duesClose },
    creditHeld: creditClose,
    byCategory,
  };
}

// ------------------------------------------------------------------ 2. apartment statement

export interface StatementLine {
  date: string;
  type: "charge" | "payment" | "opening_credit" | "adjustment";
  ref: string;
  description: string;
  debit: number; // increases what they owe
  credit: number; // decreases what they owe
  balance: number; // running; positive = owes, negative = in credit
  id: string;
  kind?: string;
}

export async function apartmentStatement(sql: Db, apartmentId: string) {
  const rows = await sql<
    { id: string; date: string; type: StatementLine["type"]; ref: string; description: string; debit: number; credit: number; kind: string; created_at: string }[]
  >`
    select id, billing_month as date, 'charge' as type, '' as ref, description, amount as debit, 0::bigint as credit, kind, created_at
      from charges where apartment_id = ${apartmentId} and status = 'active'
    union all
    select id, payment_date, case when kind = 'payment' then 'payment' else 'opening_credit' end, coalesce(receipt_no, ''),
           reference, 0::bigint, amount, method, created_at
      from payments where apartment_id = ${apartmentId} and status = 'active'
    union all
    select id, adj_date, 'adjustment', '', reason, 0::bigint, amount, kind, created_at
      from adjustments where apartment_id = ${apartmentId} and status = 'active'
    order by date, created_at`;
  let bal = 0;
  const lines: StatementLine[] = rows.map((r) => {
    bal += r.debit - r.credit;
    return { id: r.id, date: r.date, type: r.type, ref: r.ref, description: r.description, debit: r.debit, credit: r.credit, balance: bal, kind: r.kind };
  });
  return { lines, balance: bal };
}

// ------------------------------------------------------------------ 3. arrears (aging)

export async function arrearsReport(sql: Db, today: string) {
  const rows = await sql<
    { apartment_id: string; number: string; floor: number | null; owner_name: string | null; phone: string | null; due_date: string; outstanding: number }[]
  >`
    select a.id as apartment_id, a.number, a.floor, o.full_name as owner_name, o.phone, cb.due_date, cb.outstanding
    from charge_balances cb
    join apartments a on a.id = cb.apartment_id
    left join apartment_owners ao on ao.apartment_id = a.id and ao.end_date is null
    left join owners o on o.id = ao.owner_id
    where cb.status = 'active' and cb.outstanding > 0
    order by a.number`;
  const map = new Map<
    string,
    { apartmentId: string; number: string; floor: number | null; ownerName: string | null; phone: string | null; total: number; oldestDue: string; buckets: Record<AgingBucket, number> }
  >();
  for (const r of rows) {
    let e = map.get(r.apartment_id);
    if (!e) {
      e = {
        apartmentId: r.apartment_id,
        number: r.number,
        floor: r.floor,
        ownerName: r.owner_name,
        phone: r.phone,
        total: 0,
        oldestDue: r.due_date,
        buckets: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 },
      };
      map.set(r.apartment_id, e);
    }
    e.total += r.outstanding;
    if (r.due_date < e.oldestDue) e.oldestDue = r.due_date;
    e.buckets[agingBucket(daysBetween(r.due_date, today))] += r.outstanding;
  }
  const list = [...map.values()].sort((a, b) => b.total - a.total);
  const totals = list.reduce(
    (t, e) => {
      t.total += e.total;
      for (const k of Object.keys(e.buckets) as AgingBucket[]) t.buckets[k] += e.buckets[k];
      return t;
    },
    { total: 0, buckets: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 } as Record<AgingBucket, number> },
  );
  return { list, totals };
}

// ------------------------------------------------------------------ 4. expenses

export async function expensesReport(sql: Db, from: string, to: string, categoryId?: string | null) {
  const list = await sql<
    { id: string; expense_date: string; amount: number; vendor: string; description: string; method: string; reference: string; category_ar: string; category_en: string }[]
  >`
    select e.id, e.expense_date, e.amount, e.vendor, e.description, e.method, e.reference,
           c.name_ar as category_ar, c.name_en as category_en
    from expenses e join expense_categories c on c.id = e.category_id
    where e.status = 'active' and e.expense_date between ${from} and ${to}
      and (${categoryId ?? null}::uuid is null or e.category_id = ${categoryId ?? null}::uuid)
    order by e.expense_date, e.created_at`;
  const byCategory = new Map<string, { ar: string; en: string; total: number; count: number }>();
  for (const e of list) {
    const k = e.category_ar;
    const v = byCategory.get(k) ?? { ar: e.category_ar, en: e.category_en, total: 0, count: 0 };
    v.total += e.amount;
    v.count++;
    byCategory.set(k, v);
  }
  return {
    list,
    byCategory: [...byCategory.values()].sort((a, b) => b.total - a.total),
    total: list.reduce((s, e) => s + e.amount, 0),
  };
}

// ------------------------------------------------------------------ 5. collections

export async function collectionsReport(sql: Db, from: string, to: string) {
  const list = await sql<
    { id: string; receipt_no: string; payment_date: string; amount: number; method: string; payer_name: string; reference: string; number: string }[]
  >`
    select p.id, p.receipt_no, p.payment_date, p.amount, p.method, p.payer_name, p.reference, a.number
    from payments p join apartments a on a.id = p.apartment_id
    where p.status = 'active' and p.kind = 'payment' and p.payment_date between ${from} and ${to}
    order by p.payment_date, p.receipt_no`;
  const byMethod: Record<string, number> = {};
  for (const p of list) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
  return { list, byMethod, total: list.reduce((s, p) => s + p.amount, 0) };
}

// ------------------------------------------------------------------ lists used by screens

export async function chargeList(
  sql: Db,
  filter: { month?: string | null; status?: string | null; apartmentId?: string | null },
  today: string,
) {
  const rows = await sql<
    { id: string; apartment_id: string; number: string; kind: string; billing_month: string; due_date: string; amount: number; paid: number; adjusted: number; outstanding: number; status: string; description: string }[]
  >`
    select cb.id, cb.apartment_id, a.number, cb.kind, cb.billing_month, cb.due_date, cb.amount, cb.paid, cb.adjusted,
           cb.outstanding, cb.status, cb.description
    from charge_balances cb join apartments a on a.id = cb.apartment_id
    where (${filter.month ?? null}::date is null or cb.billing_month = ${filter.month ?? null}::date)
      and (${filter.apartmentId ?? null}::uuid is null or cb.apartment_id = ${filter.apartmentId ?? null}::uuid)
    order by cb.billing_month desc, a.number, cb.created_at`;
  const withState = rows.map((r) => ({
    ...r,
    state: r.status === "voided" ? null : chargeState(r.amount, r.paid, r.adjusted, r.due_date, today),
  }));
  const st = filter.status;
  if (!st) return withState;
  return withState.filter((r) => {
    if (st === "voided") return r.status === "voided";
    if (!r.state) return false;
    if (st === "overdue") return r.state.overdue;
    return r.state.status === st;
  });
}

export async function apartmentList(sql: Db, opts: { q?: string; archived?: boolean }) {
  const q = (opts.q ?? "").trim();
  const like = `%${q}%`;
  return sql<
    { id: string; number: string; floor: number | null; archived_at: string | null; owner_name: string | null; phone: string | null; outstanding: number; credit: number }[]
  >`
    select a.id, a.number, a.floor, a.archived_at, o.full_name as owner_name, o.phone,
      coalesce((select sum(outstanding) from charge_balances cb where cb.apartment_id = a.id and cb.status = 'active'), 0)::bigint as outstanding,
      coalesce((select sum(unallocated) from payment_balances pb where pb.apartment_id = a.id and pb.status = 'active'), 0)::bigint as credit
    from apartments a
    left join apartment_owners ao on ao.apartment_id = a.id and ao.end_date is null
    left join owners o on o.id = ao.owner_id
    where (${opts.archived ?? false} = (a.archived_at is not null))
      and (${q} = '' or a.number ilike ${like} or o.full_name ilike ${like} or coalesce(o.phone, '') ilike ${like})
    order by length(a.number), a.number`;
}

// ------------------------------------------------------------------ apartment detail

export async function apartmentDetail(sql: Db, id: string) {
  const [apt] = await sql<
    { id: string; number: string; floor: number | null; billing_start_month: string; notes: string; archived_at: string | null }[]
  >`select id, number, floor, billing_start_month, notes, archived_at from apartments where id = ${id}`;
  if (!apt) return null;
  const owners = await sql<
    { owner_id: string; full_name: string; phone: string | null; email: string | null; start_date: string; end_date: string | null }[]
  >`
    select o.id as owner_id, o.full_name, o.phone, o.email, ao.start_date, ao.end_date
    from apartment_owners ao join owners o on o.id = ao.owner_id
    where ao.apartment_id = ${id} order by ao.start_date desc, ao.created_at desc`;
  const [bal] = await sql<{ outstanding: number; credit: number }[]>`
    select
      coalesce((select sum(outstanding) from charge_balances where apartment_id = ${id} and status = 'active'), 0)::bigint as outstanding,
      coalesce((select sum(unallocated) from payment_balances where apartment_id = ${id} and status = 'active'), 0)::bigint as credit`;
  const fees = await sql<{ amount: number; effective_from: string }[]>`
    select amount, effective_from from fee_rates where apartment_id = ${id} order by effective_from desc`;
  return { apt, owner: owners.find((o) => !o.end_date) ?? null, owners, ...bal, fees };
}
