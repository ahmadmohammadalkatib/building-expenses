// Dues ledger + cash-in: charges, payments, allocations, credit, adjustments.
// Every function that changes money runs inside a transaction and locks the
// apartment row, so concurrent saves for the same apartment are serialized.

import type { Db, Sql, Tx } from "@/lib/db/client";
import {
  allocate,
  applyCredit,
  checkTransactionDate,
  formatReceiptNo,
  planMonthlyCharges,
  type FeeRate,
  type OpenCharge,
} from "@/lib/core/accounting";
import { addMonths, dayOfMonth, isIsoDate, monthStart } from "@/lib/core/dates";
import { AppError, audit, getSettings, isUniqueViolation, requireRole, type Actor } from "./common";

// ------------------------------------------------------------------ helpers

async function lockApartment(tx: Tx, apartmentId: string) {
  const [apt] = await tx<{ id: string; number: string; archived_at: string | null }[]>`
    select id, number, archived_at from apartments where id = ${apartmentId} for update`;
  if (!apt) throw new AppError("not_found");
  return apt;
}

async function openCharges(sql: Db, apartmentId: string): Promise<(OpenCharge & { billing_month: string })[]> {
  const rows = await sql<
    { id: string; due_date: string; billing_month: string; created_at: string; outstanding: number }[]
  >`
    select id, due_date, billing_month, created_at, outstanding
    from charge_balances
    where apartment_id = ${apartmentId} and status = 'active' and outstanding > 0`;
  return rows.map((r) => ({
    id: r.id,
    dueDate: r.due_date,
    billingMonth: r.billing_month,
    billing_month: r.billing_month,
    createdAt: r.created_at,
    outstanding: r.outstanding,
  }));
}

/**
 * Use any unallocated payment money (credit) on this apartment's open charges.
 * Caller must hold the apartment lock. Returns total applied.
 */
export async function applyApartmentCredit(tx: Tx, apartmentId: string): Promise<number> {
  const sources = await tx<{ id: string; payment_date: string; created_at: string; unallocated: number }[]>`
    select id, payment_date, created_at, unallocated from payment_balances
    where apartment_id = ${apartmentId} and status = 'active' and unallocated > 0`;
  if (!sources.length) return 0;
  const charges = await openCharges(tx, apartmentId);
  if (!charges.length) return 0;
  const lines = applyCredit(
    sources.map((s) => ({ paymentId: s.id, paymentDate: s.payment_date, createdAt: s.created_at, remaining: s.unallocated })),
    charges,
  );
  const pdate = new Map(sources.map((s) => [s.id, s.payment_date]));
  const cmonth = new Map(charges.map((c) => [c.id, c.billing_month]));
  let total = 0;
  for (const l of lines) {
    const pd = pdate.get(l.paymentId)!;
    const bm = cmonth.get(l.chargeId)!;
    const eff = pd > bm ? pd : bm;
    await tx`insert into allocations (payment_id, charge_id, amount, effective_date)
             values (${l.paymentId}, ${l.chargeId}, ${l.amount}, ${eff})`;
    total += l.amount;
  }
  return total;
}

export async function apartmentCredit(sql: Db, apartmentId: string): Promise<number> {
  const [r] = await sql<{ credit: number }[]>`
    select coalesce(sum(unallocated), 0)::bigint as credit from payment_balances
    where apartment_id = ${apartmentId} and status = 'active'`;
  return r.credit;
}

// ------------------------------------------------------------------ monthly charges

export interface GenerateResult {
  month: string;
  created: number;
  creditApplied: number;
}

const GEN_LOCK = "generate_monthly_charges";

/** Create missing monthly charges for one month (optionally only some apartments). Caller holds GEN_LOCK. */
async function generateMonthInTx(tx: Tx, actor: Actor, month: string, onlyApartment?: string) {
  const m = monthStart(month);
  const settings = await getSettings(tx);
  const rates = (
    await tx<{ apartment_id: string | null; amount: number; effective_from: string }[]>`
      select apartment_id, amount, effective_from from fee_rates`
  ).map<FeeRate>((r) => ({ apartmentId: r.apartment_id, amount: r.amount, effectiveFrom: r.effective_from }));
  const apts = await tx<{ id: string; billing_start_month: string; archived_at: string | null }[]>`
    select id, billing_start_month, archived_at from apartments
    where ${onlyApartment ?? null}::uuid is null or id = ${onlyApartment ?? null}::uuid`;
  const existing = new Set(
    (await tx<{ apartment_id: string }[]>`
      select apartment_id from charges where kind = 'monthly' and billing_month = ${m}`).map((r) => r.apartment_id),
  );
  const plan = planMonthlyCharges(
    apts.map((a) => ({ id: a.id, billingStartMonth: a.billing_start_month, archivedAt: a.archived_at })),
    rates,
    m,
    existing,
  );
  const due = dayOfMonth(m, settings.due_day);
  let created = 0;
  let creditApplied = 0;
  for (const c of plan) {
    const ins = await tx`
      insert into charges (apartment_id, kind, billing_month, due_date, amount, description, created_by)
      values (${c.apartmentId}, 'monthly', ${m}, ${due}, ${c.amount}, '', ${actor.id})
      on conflict (apartment_id, billing_month) where kind = 'monthly' do nothing
      returning id`;
    if (ins.length) {
      created++;
      await lockApartment(tx, c.apartmentId);
      creditApplied += await applyApartmentCredit(tx, c.apartmentId);
    }
  }
  return { month: m, created, creditApplied };
}

/** Idempotent: safe to run any number of times (manual button for one month). */
export async function generateMonthlyCharges(
  sql: Sql,
  actor: Actor,
  month: string,
  triggeredBy: "cron" | "manual",
): Promise<GenerateResult> {
  requireRole(actor, "treasurer");
  if (!isIsoDate(month)) throw new AppError("invalid_date");
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${GEN_LOCK}))`;
    const r = await generateMonthInTx(tx, actor, month);
    await tx`insert into job_runs (job, month, created_count, credit_applied, triggered_by)
             values ('monthly_charges', ${r.month}, ${r.created}, ${r.creditApplied}, ${triggeredBy})`;
    if (r.created) await audit(tx, actor, "generate", "charges", null, { ...r, triggeredBy });
    return r;
  });
}

/**
 * Bring monthly charges up to date: every billable month from each apartment's billing start
 * through the current month. Used when an apartment is added, when a fee is added, and by cron.
 * Idempotent (existing months are skipped; the unique index guarantees no duplicates).
 */
export async function catchUpChargesInTx(tx: Tx, actor: Actor, today: string, onlyApartment?: string): Promise<GenerateResult> {
  await tx`select pg_advisory_xact_lock(hashtext(${GEN_LOCK}))`;
  const [{ first }] = await tx<{ first: string | null }[]>`
    select min(billing_start_month) as first from apartments
    where ${onlyApartment ?? null}::uuid is null or id = ${onlyApartment ?? null}::uuid`;
  const current = monthStart(today);
  let created = 0;
  let creditApplied = 0;
  if (first) {
    for (let m = first; m <= current; m = addMonths(m, 1)) {
      const r = await generateMonthInTx(tx, actor, m, onlyApartment);
      created += r.created;
      creditApplied += r.creditApplied;
    }
  }
  if (created) await audit(tx, actor, "generate", "charges", onlyApartment ?? null, { upTo: current, created, creditApplied });
  return { month: current, created, creditApplied };
}

export async function catchUpCharges(sql: Sql, actor: Actor, today: string, triggeredBy: "cron" | "manual") {
  requireRole(actor, "treasurer");
  return sql.begin(async (tx) => {
    const r = await catchUpChargesInTx(tx, actor, today);
    await tx`insert into job_runs (job, month, created_count, credit_applied, triggered_by)
             values ('monthly_charges', ${r.month}, ${r.created}, ${r.creditApplied}, ${triggeredBy})`;
    return r;
  });
}

export async function generatedMonths(sql: Db): Promise<Set<string>> {
  const rows = await sql<{ m: string }[]>`select distinct billing_month as m from charges where kind = 'monthly'`;
  return new Set(rows.map((r) => r.m));
}

// ------------------------------------------------------------------ manual charges

export interface NewCharge {
  apartmentId: string;
  kind: "special" | "opening" | "other";
  billingMonth: string;
  dueDate: string;
  amount: number;
  description: string;
}

export async function createCharge(sql: Sql, actor: Actor, input: NewCharge): Promise<string> {
  requireRole(actor, "treasurer");
  if (!isIsoDate(input.billingMonth) || !isIsoDate(input.dueDate)) throw new AppError("invalid_date");
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new AppError("invalid_amount");
  if (input.kind !== "opening" && !input.description.trim()) throw new AppError("description_required");
  return sql.begin(async (tx) => {
    await lockApartment(tx, input.apartmentId);
    const [row] = await tx<{ id: string }[]>`
      insert into charges (apartment_id, kind, billing_month, due_date, amount, description, created_by)
      values (${input.apartmentId}, ${input.kind}, ${monthStart(input.billingMonth)}, ${input.dueDate},
              ${input.amount}, ${input.description.trim()}, ${actor.id})
      returning id`;
    const applied = await applyApartmentCredit(tx, input.apartmentId);
    await audit(tx, actor, "create", "charge", row.id, { ...input, creditApplied: applied });
    return row.id;
  });
}

export async function voidCharge(sql: Sql, actor: Actor, chargeId: string, reason: string): Promise<void> {
  requireRole(actor, "treasurer");
  if (!reason.trim()) throw new AppError("reason_required");
  await sql.begin(async (tx) => {
    const [c] = await tx<{ apartment_id: string; status: string }[]>`select apartment_id, status from charges where id = ${chargeId}`;
    if (!c) throw new AppError("not_found");
    await lockApartment(tx, c.apartment_id);
    if (c.status === "voided") throw new AppError("already_voided");
    await tx`update charges set status = 'voided', void_reason = ${reason.trim()}, voided_at = now(), voided_by = ${actor.id}
             where id = ${chargeId}`;
    // Money paid toward this charge goes back to the apartment as credit…
    const released = await tx<{ amount: number }[]>`
      update allocations set released_at = now() where charge_id = ${chargeId} and released_at is null returning amount`;
    // …and is immediately used on any other open charges.
    const reapplied = await applyApartmentCredit(tx, c.apartment_id);
    await audit(tx, actor, "void", "charge", chargeId, {
      reason,
      released: released.reduce((s, r) => s + r.amount, 0),
      reapplied,
    });
  });
}

// ------------------------------------------------------------------ adjustments

export async function addAdjustment(
  sql: Sql,
  actor: Actor,
  input: { chargeId: string; kind: "waiver" | "discount" | "correction"; amount: number; date: string; reason: string },
): Promise<string> {
  requireRole(actor, "treasurer");
  if (!input.reason.trim()) throw new AppError("reason_required");
  if (!isIsoDate(input.date)) throw new AppError("invalid_date");
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new AppError("invalid_amount");
  return sql.begin(async (tx) => {
    const [c] = await tx<{ apartment_id: string }[]>`select apartment_id from charges where id = ${input.chargeId}`;
    if (!c) throw new AppError("not_found");
    await lockApartment(tx, c.apartment_id);
    const [cb] = await tx<{ status: string; outstanding: number }[]>`
      select status, outstanding from charge_balances where id = ${input.chargeId}`;
    if (cb.status !== "active") throw new AppError("already_voided");
    if (input.amount > cb.outstanding) throw new AppError("adjustment_exceeds", { max: cb.outstanding });
    const [row] = await tx<{ id: string }[]>`
      insert into adjustments (charge_id, apartment_id, kind, amount, adj_date, reason, created_by)
      values (${input.chargeId}, ${c.apartment_id}, ${input.kind}, ${input.amount}, ${input.date}, ${input.reason.trim()}, ${actor.id})
      returning id`;
    await audit(tx, actor, "create", "adjustment", row.id, input);
    return row.id;
  });
}

export async function voidAdjustment(sql: Sql, actor: Actor, adjustmentId: string, reason: string) {
  requireRole(actor, "treasurer");
  if (!reason.trim()) throw new AppError("reason_required");
  await sql.begin(async (tx) => {
    const [a] = await tx<{ apartment_id: string; status: string }[]>`
      select apartment_id, status from adjustments where id = ${adjustmentId}`;
    if (!a) throw new AppError("not_found");
    await lockApartment(tx, a.apartment_id);
    if (a.status === "voided") throw new AppError("already_voided");
    await tx`update adjustments set status = 'voided', void_reason = ${reason.trim()}, voided_at = now(), voided_by = ${actor.id}
             where id = ${adjustmentId}`;
    const reapplied = await applyApartmentCredit(tx, a.apartment_id);
    await audit(tx, actor, "void", "adjustment", adjustmentId, { reason, reapplied });
  });
}

// ------------------------------------------------------------------ payments

export async function previewPayment(sql: Db, apartmentId: string, amount: number) {
  const charges = await openCharges(sql, apartmentId);
  const { lines, credit } = allocate(Math.max(0, amount), charges);
  const byId = new Map(charges.map((c) => [c.id, c]));
  return {
    lines: lines.map((l) => ({ ...l, billingMonth: byId.get(l.chargeId)!.billingMonth, outstanding: byId.get(l.chargeId)!.outstanding })),
    credit,
    totalOutstanding: charges.reduce((s, c) => s + c.outstanding, 0),
  };
}

export interface NewPayment {
  apartmentId: string;
  amount: number;
  date: string;
  method: "cash" | "bank_transfer" | "cheque" | "card" | "other";
  payerName: string;
  reference: string;
  notes: string;
  idempotencyKey: string;
  kind?: "payment" | "opening_credit";
}

export async function recordPayment(
  sql: Sql,
  actor: Actor,
  input: NewPayment,
  today: string,
): Promise<{ id: string; receiptNo: string | null; duplicate: boolean }> {
  requireRole(actor, "treasurer");
  const kind = input.kind ?? "payment";
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new AppError("invalid_amount");
  if (!isIsoDate(input.date)) throw new AppError("invalid_date");
  const settings = await getSettings(sql);
  if (kind === "payment") {
    if (!settings.opening_date) throw new AppError("opening_not_set");
    const chk = checkTransactionDate(input.date, settings.opening_date, today);
    if (chk !== "ok") throw new AppError(`date_${chk}`);
  }

  // Duplicate submit (double click / retry) → return the original payment.
  const [dup] = await sql<{ id: string; receipt_no: string | null }[]>`
    select id, receipt_no from payments where idempotency_key = ${input.idempotencyKey}`;
  if (dup) return { id: dup.id, receiptNo: dup.receipt_no, duplicate: true };

  try {
    return await sql.begin(async (tx) => {
      const apt = await lockApartment(tx, input.apartmentId);
      // Payments on archived apartments are allowed (settling old debts).
      let receiptNo: string | null = null;
      if (kind === "payment") {
        const year = Number(input.date.slice(0, 4));
        const [cnt] = await tx<{ last_no: number }[]>`
          insert into receipt_counters (year, last_no) values (${year}, 1)
          on conflict (year) do update set last_no = receipt_counters.last_no + 1
          returning last_no`;
        receiptNo = formatReceiptNo(settings.receipt_prefix, year, cnt.last_no);
      }
      const [p] = await tx<{ id: string }[]>`
        insert into payments (receipt_no, kind, apartment_id, payer_name, amount, payment_date, method,
                              reference, notes, idempotency_key, created_by)
        values (${receiptNo}, ${kind}, ${input.apartmentId}, ${input.payerName.trim()}, ${input.amount}, ${input.date},
                ${input.method}, ${input.reference.trim()}, ${input.notes.trim()}, ${input.idempotencyKey}, ${actor.id})
        returning id`;
      const charges = await openCharges(tx, input.apartmentId);
      const { lines, credit } = allocate(input.amount, charges);
      const cmonth = new Map(charges.map((c) => [c.id, c.billing_month]));
      for (const l of lines) {
        // Money can't settle a charge before the charge exists: effective = later of the two dates.
        const bm = cmonth.get(l.chargeId)!;
        const eff = input.date > bm ? input.date : bm;
        await tx`insert into allocations (payment_id, charge_id, amount, effective_date)
                 values (${p.id}, ${l.chargeId}, ${l.amount}, ${eff})`;
      }
      await audit(tx, actor, "create", kind === "payment" ? "payment" : "opening_credit", p.id, {
        receiptNo,
        apartment: apt.number,
        amount: input.amount,
        date: input.date,
        allocated: lines,
        credit,
      });
      return { id: p.id, receiptNo, duplicate: false };
    });
  } catch (e) {
    if (isUniqueViolation(e, "payments_idempotency_key_key")) {
      const [d] = await sql<{ id: string; receipt_no: string | null }[]>`
        select id, receipt_no from payments where idempotency_key = ${input.idempotencyKey}`;
      return { id: d.id, receiptNo: d.receipt_no, duplicate: true };
    }
    throw e;
  }
}

/** Void = the payment never happened. Receipt number is kept (and shown as VOID). */
export async function voidPayment(sql: Sql, actor: Actor, paymentId: string, reason: string) {
  requireRole(actor, "treasurer");
  if (!reason.trim()) throw new AppError("reason_required");
  await sql.begin(async (tx) => {
    const [p] = await tx<{ apartment_id: string; status: string; receipt_no: string | null }[]>`
      select apartment_id, status, receipt_no from payments where id = ${paymentId}`;
    if (!p) throw new AppError("not_found");
    await lockApartment(tx, p.apartment_id);
    if (p.status === "voided") throw new AppError("already_voided");
    await tx`update payments set status = 'voided', void_reason = ${reason.trim()}, voided_at = now(), voided_by = ${actor.id}
             where id = ${paymentId}`;
    // Charges it paid reopen; any other credit on the apartment is used on them.
    const reapplied = await applyApartmentCredit(tx, p.apartment_id);
    await audit(tx, actor, "void", "payment", paymentId, { reason, receiptNo: p.receipt_no, reapplied });
  });
}

export async function editPaymentDetails(
  sql: Sql,
  actor: Actor,
  paymentId: string,
  input: { payerName: string; reference: string; notes: string; method: NewPayment["method"] },
) {
  requireRole(actor, "treasurer");
  await sql.begin(async (tx) => {
    const [before] = await tx<{ payer_name: string; reference: string; notes: string; method: string; status: string }[]>`
      select payer_name, reference, notes, method, status from payments where id = ${paymentId} for update`;
    if (!before) throw new AppError("not_found");
    if (before.status === "voided") throw new AppError("already_voided");
    await tx`update payments set payer_name = ${input.payerName.trim()}, reference = ${input.reference.trim()},
             notes = ${input.notes.trim()}, method = ${input.method} where id = ${paymentId}`;
    await audit(tx, actor, "edit", "payment", paymentId, { before, after: input });
  });
}
