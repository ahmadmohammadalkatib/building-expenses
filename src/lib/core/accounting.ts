// Pure accounting rules. No I/O here — everything is unit-tested.
//
// Two ledgers that must never be mixed:
//   Cash (the fund) = opening balance + payments − expenses        (dated by payment/expense date)
//   Dues            = charges − allocations − adjustments          (dated by billing month / due date)
// A payment adds to cash once and reduces dues through its allocations.
// An adjustment touches dues only. An expense touches cash only.

import type { Agorot } from "./money";
import { addMonths, monthStart } from "./dates";

// ---------- Fees ----------

export interface FeeRate {
  apartmentId: string | null; // null = building-wide rate
  amount: Agorot;
  effectiveFrom: string; // YYYY-MM-01
}

/**
 * Monthly fee for an apartment in a given month: the latest apartment-specific override
 * effective on/before the month wins, otherwise the latest building-wide rate.
 */
export function feeForMonth(rates: FeeRate[], apartmentId: string, month: string): Agorot | null {
  const m = monthStart(month);
  const pick = (list: FeeRate[]) =>
    list
      .filter((r) => r.effectiveFrom <= m)
      .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
  const override = pick(rates.filter((r) => r.apartmentId === apartmentId));
  if (override) return override.amount;
  const base = pick(rates.filter((r) => r.apartmentId === null));
  return base ? base.amount : null;
}

// ---------- Monthly charge generation ----------

export interface BillableApartment {
  id: string;
  billingStartMonth: string; // first month this apartment is billed (full month, no prorating)
  archivedAt: string | null; // date; no charges for months after archiving
}

export interface PlannedCharge {
  apartmentId: string;
  billingMonth: string;
  amount: Agorot;
}

/**
 * Which monthly charges should exist for `month`. Idempotency is enforced by the caller
 * (existing charges are skipped) and by a unique index in the database.
 */
export function planMonthlyCharges(
  apartments: BillableApartment[],
  rates: FeeRate[],
  month: string,
  existing: Set<string>, // apartmentIds already charged for this month (active or voided)
): PlannedCharge[] {
  const m = monthStart(month);
  const out: PlannedCharge[] = [];
  for (const apt of apartments) {
    if (existing.has(apt.id)) continue;
    if (monthStart(apt.billingStartMonth) > m) continue;
    if (apt.archivedAt && monthStart(apt.archivedAt) < m) continue;
    const amount = feeForMonth(rates, apt.id, m);
    if (!amount || amount <= 0) continue;
    out.push({ apartmentId: apt.id, billingMonth: m, amount });
  }
  return out;
}

// ---------- Allocation (oldest first) ----------

export interface OpenCharge {
  id: string;
  dueDate: string;
  billingMonth: string;
  createdAt: string; // ISO timestamp, final tie-break
  outstanding: Agorot;
}

export interface AllocationLine {
  chargeId: string;
  amount: Agorot;
}

/** Oldest-first ordering: due date, then billing month, then creation time, then id. */
export function sortOldestFirst<T extends OpenCharge>(charges: T[]): T[] {
  return [...charges].sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      a.billingMonth.localeCompare(b.billingMonth) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Split `amount` across open charges, oldest first. Whatever is left over is credit
 * that stays on the apartment and is applied automatically to future charges.
 */
export function allocate(
  amount: Agorot,
  charges: OpenCharge[],
): { lines: AllocationLine[]; credit: Agorot } {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("amount must be a non-negative integer");
  let left = amount;
  const lines: AllocationLine[] = [];
  for (const c of sortOldestFirst(charges)) {
    if (left <= 0) break;
    if (c.outstanding <= 0) continue;
    const take = Math.min(left, c.outstanding);
    lines.push({ chargeId: c.id, amount: take });
    left -= take;
  }
  return { lines, credit: left };
}

/**
 * Apply available credit (from earlier payments with unallocated money, oldest payment first)
 * to open charges (oldest first). Returns allocation lines tagged with the source payment.
 */
export interface CreditSource {
  paymentId: string;
  paymentDate: string;
  createdAt: string;
  remaining: Agorot;
}

export function applyCredit(
  sources: CreditSource[],
  charges: OpenCharge[],
): Array<AllocationLine & { paymentId: string }> {
  const pool = [...sources]
    .filter((s) => s.remaining > 0)
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.createdAt.localeCompare(b.createdAt))
    .map((s) => ({ ...s }));
  const out: Array<AllocationLine & { paymentId: string }> = [];
  for (const c of sortOldestFirst(charges)) {
    let need = c.outstanding;
    for (const s of pool) {
      if (need <= 0) break;
      if (s.remaining <= 0) continue;
      const take = Math.min(need, s.remaining);
      out.push({ paymentId: s.paymentId, chargeId: c.id, amount: take });
      s.remaining -= take;
      need -= take;
    }
  }
  return out;
}

// ---------- Charge status ----------

export type PayStatus = "unpaid" | "partial" | "paid";

export interface ChargeState {
  status: PayStatus;
  overdue: boolean;
  outstanding: Agorot;
}

/**
 * Payment status plus a separate overdue flag ("Partially paid · Overdue").
 * Adjustments/waivers count toward settling the charge.
 */
export function chargeState(
  amount: Agorot,
  paid: Agorot,
  adjusted: Agorot,
  dueDate: string,
  today: string,
): ChargeState {
  const outstanding = Math.max(0, amount - paid - adjusted);
  const status: PayStatus = outstanding === 0 ? "paid" : paid + adjusted > 0 ? "partial" : "unpaid";
  return { status, overdue: outstanding > 0 && dueDate < today, outstanding };
}

// ---------- Cash ledger ----------

export interface CashMovement {
  date: string;
  amount: Agorot; // +payment / −expense
}

export function fundBalance(opening: Agorot, movements: CashMovement[], asOf?: string): Agorot {
  return movements
    .filter((m) => !asOf || m.date <= asOf)
    .reduce((sum, m) => sum + m.amount, opening);
}

export interface PeriodCash {
  openingBalance: Agorot;
  collections: Agorot;
  expenses: Agorot;
  closingBalance: Agorot;
}

/** Cash summary for [from, to] inclusive. */
export function periodCash(
  opening: Agorot,
  openingDate: string,
  payments: CashMovement[],
  expenses: CashMovement[], // amounts positive
  from: string,
  to: string,
): PeriodCash {
  const before = (d: string) => d < from && d >= openingDate;
  const within = (d: string) => d >= from && d <= to;
  const sum = (xs: CashMovement[], f: (d: string) => boolean) =>
    xs.filter((x) => f(x.date)).reduce((s, x) => s + x.amount, 0);
  const openingBalance = opening + sum(payments, before) - sum(expenses, before);
  const collections = sum(payments, within);
  const exp = sum(expenses, within);
  return { openingBalance, collections, expenses: exp, closingBalance: openingBalance + collections - exp };
}

// ---------- Validation rules ----------

export type DateCheck = "ok" | "before_opening" | "future";

export function checkTransactionDate(date: string, openingDate: string | null, today: string): DateCheck {
  if (openingDate && date < openingDate) return "before_opening";
  if (date > today) return "future";
  return "ok";
}

/** Fee changes may only start in a month whose monthly charges haven't been generated. */
export function canFeeStartIn(month: string, generatedMonths: Set<string>): boolean {
  return !generatedMonths.has(monthStart(month));
}

export function nextUngeneratedMonth(today: string, generatedMonths: Set<string>): string {
  let m = monthStart(today);
  while (generatedMonths.has(m)) m = addMonths(m, 1);
  return m;
}

// ---------- Aging ----------

export type AgingBucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90p";

export function agingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "d1_30";
  if (daysOverdue <= 60) return "d31_60";
  if (daysOverdue <= 90) return "d61_90";
  return "d90p";
}

// ---------- Receipts ----------

export function formatReceiptNo(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}
