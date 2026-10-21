// Acceptance tests (AC-01 … AC-20) against a real Postgres built from the migrations.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "@/lib/db/client";
import { ADMIN, VIEWER, freshDb, key } from "./helpers/db";
import {
  addAdjustment,
  apartmentCredit,
  createCharge,
  generateMonthlyCharges,
  previewPayment,
  recordPayment,
  voidCharge,
  voidPayment,
  type NewPayment,
} from "@/lib/services/ledger";
import { addFee, createApartment, setOpeningArrears, updateSettings } from "@/lib/services/setup";
import { recordExpense, voidExpense } from "@/lib/services/expenses";
import {
  apartmentStatement,
  arrearsReport,
  cashBalance,
  chargeList,
  creditHeld,
  dashboard,
  duesOutstanding,
  monthlySummary,
} from "@/lib/services/reports";

let sql: Sql;
let drop: () => Promise<void>;
const TODAY = "2026-10-21";

beforeAll(async () => {
  ({ sql, drop } = await freshDb());
});
afterAll(async () => {
  await drop?.();
});

async function reset() {
  // Tests share one DB; truncate as table owner isn't possible for app_server, so
  // we isolate by creating distinct apartments per test instead.
}

let aptSeq = 0;
async function apt(start = "2026-01-01") {
  return createApartment(sql, ADMIN, { number: `T${++aptSeq}`, floor: 1, billingStartMonth: start, notes: "" });
}
function pay(apartmentId: string, amount: number, date: string, extra: Partial<NewPayment> = {}) {
  return recordPayment(
    sql,
    ADMIN,
    { apartmentId, amount, date, method: "cash", payerName: "", reference: "", notes: "", idempotencyKey: key(), ...extra },
    TODAY,
  );
}
async function categoryId() {
  const [c] = await sql<{ id: string }[]>`select id from expense_categories order by sort limit 1`;
  return c.id;
}
function expense(amount: number, date: string, cat: string) {
  return recordExpense(
    sql,
    ADMIN,
    { categoryId: cat, amount, date, vendor: "v", description: "d", method: "cash", reference: "", attachmentPath: null, idempotencyKey: key() },
    TODAY,
  );
}
async function aptOutstanding(apartmentId: string) {
  const [r] = await sql<{ o: number }[]>`
    select coalesce(sum(outstanding),0)::bigint as o from charge_balances where apartment_id = ${apartmentId} and status = 'active'`;
  return r.o;
}

describe("acceptance", () => {
  beforeEach(reset);

  it("setup: opening balance and building fee", async () => {
    await updateSettings(sql, ADMIN, { building_name: "Test", opening_balance: 50000, opening_date: "2026-01-01", due_day: 10 });
    await addFee(sql, ADMIN, { apartmentId: null, amount: 10000, effectiveFrom: "2026-01-01", note: "" });
    const s = await sql`select opening_balance, opening_date from settings`;
    expect(s[0]).toEqual({ opening_balance: 50000, opening_date: "2026-01-01" });
  });

  it("AC-01 monthly generation is idempotent", async () => {
    const a = await apt();
    const r1 = await generateMonthlyCharges(sql, ADMIN, "2026-01-01", "manual");
    const r2 = await generateMonthlyCharges(sql, ADMIN, "2026-01-01", "cron");
    expect(r1.created).toBeGreaterThanOrEqual(1);
    expect(r2.created).toBe(0);
    const rows = await sql`select * from charges where apartment_id = ${a} and kind = 'monthly'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].due_date).toBe("2026-01-10");
    // concurrent runs also produce no duplicates
    await Promise.all([
      generateMonthlyCharges(sql, ADMIN, "2026-02-01", "cron"),
      generateMonthlyCharges(sql, ADMIN, "2026-02-01", "manual"),
    ]);
    const feb = await sql`select * from charges where apartment_id = ${a} and billing_month = '2026-02-01'`;
    expect(feb).toHaveLength(1);
  });

  it("AC-02 effective-dated fee + per-apartment override; no change for generated months", async () => {
    const a = await apt();
    await addFee(sql, ADMIN, { apartmentId: a, amount: 7500, effectiveFrom: "2026-03-01", note: "discount" });
    await expect(
      addFee(sql, ADMIN, { apartmentId: null, amount: 12000, effectiveFrom: "2026-02-01", note: "" }),
    ).rejects.toMatchObject({ code: "fee_month_generated" });
    await generateMonthlyCharges(sql, ADMIN, "2026-03-01", "manual");
    const [c] = await sql`select amount from charges where apartment_id = ${a} and billing_month = '2026-03-01'`;
    expect(c.amount).toBe(7500);
  });

  it("AC-03/04 payment pays oldest first; status partial + overdue flag", async () => {
    const a = await apt("2026-04-01");
    await generateMonthlyCharges(sql, ADMIN, "2026-04-01", "manual");
    await generateMonthlyCharges(sql, ADMIN, "2026-05-01", "manual");
    const preview = await previewPayment(sql, a, 15000);
    expect(preview.lines.map((l) => [l.billingMonth, l.amount])).toEqual([
      ["2026-04-01", 10000],
      ["2026-05-01", 5000],
    ]);
    const r = await pay(a, 15000, "2026-05-03");
    expect(r.receiptNo).toMatch(/^R-2026-\d{4}$/);
    const list = await chargeList(sql, { apartmentId: a }, TODAY);
    const may = list.find((c) => c.billing_month === "2026-05-01")!;
    const apr = list.find((c) => c.billing_month === "2026-04-01")!;
    expect(apr.state).toMatchObject({ status: "paid", overdue: false });
    expect(may.state).toMatchObject({ status: "partial", overdue: true, outstanding: 5000 });
  });

  it("AC-05 overpayment becomes credit and is applied when new charges are generated", async () => {
    const a = await apt("2026-06-01");
    await generateMonthlyCharges(sql, ADMIN, "2026-06-01", "manual");
    await pay(a, 60000, "2026-06-02"); // six months ahead
    expect(await apartmentCredit(sql, a)).toBe(50000);
    await generateMonthlyCharges(sql, ADMIN, "2026-07-01", "cron");
    expect(await apartmentCredit(sql, a)).toBe(40000);
    expect(await aptOutstanding(a)).toBe(0);
    // invariant: credit and open charges never coexist
    const list = await chargeList(sql, { apartmentId: a }, TODAY);
    expect(list.every((c) => c.state?.status === "paid")).toBe(true);
  });

  it("AC-06 void payment: never happened; receipt number kept and not reused", async () => {
    const a = await apt("2026-08-01");
    await generateMonthlyCharges(sql, ADMIN, "2026-08-01", "manual");
    const cashBefore = await cashBalance(sql, TODAY);
    const p = await pay(a, 10000, "2026-08-05");
    expect(await cashBalance(sql, TODAY)).toBe(cashBefore + 10000);
    await voidPayment(sql, ADMIN, p.id, "bounced cheque");
    expect(await cashBalance(sql, TODAY)).toBe(cashBefore);
    expect(await aptOutstanding(a)).toBe(10000);
    const [v] = await sql`select receipt_no, status from payments where id = ${p.id}`;
    expect(v).toEqual({ receipt_no: p.receiptNo, status: "voided" });
    const p2 = await pay(a, 10000, "2026-08-06");
    expect(p2.receiptNo).not.toBe(p.receiptNo);
    await expect(voidPayment(sql, ADMIN, p.id, "again")).rejects.toMatchObject({ code: "already_voided" });
  });

  it("AC-07/08 cash and dues are separate ledgers (₪750 cash, ₪300 dues)", async () => {
    // Use a dedicated time window: compare deltas
    const cat = await categoryId();
    const a = await apt("2026-09-01");
    const cash0 = await cashBalance(sql, TODAY);
    const dues0 = await duesOutstanding(sql, TODAY);
    // charge 700, pay 400 → dues +300, cash +400; expense 150 → cash −150, dues unchanged
    await createCharge(sql, ADMIN, { apartmentId: a, kind: "special", billingMonth: "2026-09-01", dueDate: "2026-09-15", amount: 70000, description: "roof" });
    await pay(a, 40000, "2026-09-10");
    await expense(15000, "2026-09-11", cat);
    expect((await cashBalance(sql, TODAY)) - cash0).toBe(25000);
    expect((await duesOutstanding(sql, TODAY)) - dues0).toBe(30000);
  });

  it("AC-09 waiver reduces dues only; cannot exceed outstanding", async () => {
    const a = await apt("2026-09-01");
    const c = await createCharge(sql, ADMIN, { apartmentId: a, kind: "other", billingMonth: "2026-09-01", dueDate: "2026-09-10", amount: 20000, description: "fine" });
    const cash0 = await cashBalance(sql, TODAY);
    await addAdjustment(sql, ADMIN, { chargeId: c, kind: "waiver", amount: 5000, date: "2026-09-12", reason: "hardship" });
    expect(await aptOutstanding(a)).toBe(15000);
    expect(await cashBalance(sql, TODAY)).toBe(cash0);
    await expect(
      addAdjustment(sql, ADMIN, { chargeId: c, kind: "waiver", amount: 99999, date: "2026-09-12", reason: "x" }),
    ).rejects.toMatchObject({ code: "adjustment_exceeds" });
  });

  it("AC-10 date guardrails", async () => {
    const a = await apt();
    await expect(pay(a, 100, "2025-12-31")).rejects.toMatchObject({ code: "date_before_opening" });
    await expect(pay(a, 100, "2026-10-22")).rejects.toMatchObject({ code: "date_future" });
    await expect(expense(100, "2025-12-31", await categoryId())).rejects.toMatchObject({ code: "date_before_opening" });
  });

  it("AC-11 voiding a March payment in May removes it from March (void = never happened)", async () => {
    const a = await apt("2026-03-01");
    await generateMonthlyCharges(sql, ADMIN, "2026-03-01", "manual");
    const before = await monthlySummary(sql, "2026-03-01");
    const p = await pay(a, 10000, "2026-03-15");
    const during = await monthlySummary(sql, "2026-03-01");
    expect(during.cash.collections - before.cash.collections).toBe(10000);
    await voidPayment(sql, ADMIN, p.id, "entered twice");
    const after = await monthlySummary(sql, "2026-03-01");
    expect(after.cash.collections).toBe(before.cash.collections);
    expect(after.dues.closing).toBe(before.dues.closing);
  });

  it("AC-12 duplicate submission returns the original payment", async () => {
    const a = await apt();
    const k = key();
    const p1 = await pay(a, 1000, "2026-10-01", { idempotencyKey: k });
    const p2 = await pay(a, 1000, "2026-10-01", { idempotencyKey: k });
    expect(p2).toEqual({ ...p1, duplicate: true });
  });

  it("AC-13 concurrent payments get distinct sequential receipt numbers", async () => {
    const a = await apt();
    const b = await apt();
    const res = await Promise.all(Array.from({ length: 8 }, (_, i) => pay(i % 2 ? a : b, 500, "2026-10-02")));
    const nos = res.map((r) => r.receiptNo);
    expect(new Set(nos).size).toBe(8);
  });

  it("AC-14 two special assessments in one month are allowed", async () => {
    const a = await apt();
    const base = { apartmentId: a, kind: "special" as const, billingMonth: "2026-10-01", dueDate: "2026-10-30", amount: 1000 };
    await createCharge(sql, ADMIN, { ...base, description: "paint" });
    await createCharge(sql, ADMIN, { ...base, description: "pump" });
    const rows = await sql`select id from charges where apartment_id = ${a} and kind = 'special'`;
    expect(rows).toHaveLength(2);
    await expect(
      sql`insert into charges (apartment_id, kind, billing_month, due_date, amount)
          values (${a}, 'monthly', '2026-01-01', '2026-01-10', 1), (${a}, 'monthly', '2026-01-01', '2026-01-10', 1)`,
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("AC-15 month-end outstanding uses effective dates (paid late counts as owed at month-end)", async () => {
    const a = await apt("2026-07-01");
    await generateMonthlyCharges(sql, ADMIN, "2026-07-01", "manual");
    const before = (await monthlySummary(sql, "2026-07-01")).dues.closing;
    await pay(a, 10000, "2026-08-20"); // pays July in August
    expect((await monthlySummary(sql, "2026-07-01")).dues.closing).toBe(before); // July still shows it owed
    const aug = await monthlySummary(sql, "2026-08-01");
    expect(aug.dues.collected).toBeGreaterThanOrEqual(10000);
  });

  it("AC-16 voiding a charge returns its payments to credit and reapplies them", async () => {
    const a = await apt("2026-09-01");
    const c1 = await createCharge(sql, ADMIN, { apartmentId: a, kind: "other", billingMonth: "2026-09-01", dueDate: "2026-09-05", amount: 3000, description: "wrong" });
    await pay(a, 3000, "2026-09-06");
    const c2 = await createCharge(sql, ADMIN, { apartmentId: a, kind: "other", billingMonth: "2026-09-01", dueDate: "2026-09-20", amount: 2000, description: "right" });
    expect(await aptOutstanding(a)).toBe(2000);
    await voidCharge(sql, ADMIN, c1, "entered by mistake");
    expect(await aptOutstanding(a)).toBe(0);
    expect(await apartmentCredit(sql, a)).toBe(1000);
    const [s] = await sql`select status, outstanding from charge_balances where id = ${c2}`;
    expect(s).toEqual({ status: "active", outstanding: 0 });
  });

  it("AC-17 audit log is append-only; money rows can't be deleted or have amounts edited", async () => {
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from audit_log`;
    expect(n.n).toBeGreaterThan(5);
    await expect(sql`update audit_log set action = 'x'`).rejects.toBeTruthy();
    await expect(sql`delete from audit_log`).rejects.toBeTruthy();
    const [p] = await sql<{ id: string }[]>`select id from payments limit 1`;
    await expect(sql`delete from payments where id = ${p.id}`).rejects.toBeTruthy();
    await expect(sql`update payments set amount = amount + 1 where id = ${p.id}`).rejects.toBeTruthy();
  });

  it("AC-18 opening arrears and opening credit affect dues, never cash", async () => {
    const a = await apt("2026-11-01");
    const cash0 = await cashBalance(sql, TODAY);
    await setOpeningArrears(sql, ADMIN, a, 30000);
    expect(await aptOutstanding(a)).toBe(30000);
    const b = await apt("2026-11-01");
    await pay(b, 20000, "2026-01-01", { kind: "opening_credit" });
    expect(await cashBalance(sql, TODAY)).toBe(cash0);
    expect(await apartmentCredit(sql, b)).toBe(20000);
    const [oc] = await sql`select receipt_no from payments where apartment_id = ${b}`;
    expect(oc.receipt_no).toBeNull();
  });

  it("AC-19 currency, time zone and opening balance lock once money has moved", async () => {
    await expect(updateSettings(sql, ADMIN, { opening_balance: 1 })).rejects.toMatchObject({ code: "settings_locked" });
    await expect(updateSettings(sql, ADMIN, { timezone: "Asia/Jerusalem" })).rejects.toMatchObject({ code: "settings_locked" });
    await updateSettings(sql, ADMIN, { building_name: "Renamed" }); // descriptive fields still editable
  });

  it("AC-20 roles: viewer cannot post money", async () => {
    const a = await apt();
    await expect(
      recordPayment(sql, VIEWER, { apartmentId: a, amount: 1, date: "2026-10-01", method: "cash", payerName: "", reference: "", notes: "", idempotencyKey: key() }, TODAY),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("void expense restores cash; reports and dashboard run", async () => {
    const cat = await categoryId();
    const c0 = await cashBalance(sql, TODAY);
    const e = await expense(999, "2026-10-01", cat);
    await voidExpense(sql, ADMIN, e.id, "dup");
    expect(await cashBalance(sql, TODAY)).toBe(c0);
    const d = await dashboard(sql, TODAY);
    expect(d.series).toHaveLength(6);
    expect(d.cash).toBe(c0);
    const ar = await arrearsReport(sql, TODAY);
    expect(ar.totals.total).toBe(await duesOutstanding(sql, TODAY));
    const [any] = await sql<{ id: string }[]>`select id from apartments limit 1`;
    const st = await apartmentStatement(sql, any.id);
    expect(typeof st.balance).toBe("number");
    expect(await creditHeld(sql, TODAY)).toBeGreaterThanOrEqual(0);
    // Dues identity: closing = opening + billed − collected − adjusted
    for (const m of ["2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"]) {
      const s = await monthlySummary(sql, m);
      expect(s.dues.closing).toBe(s.dues.opening + s.dues.billed - s.dues.collected - s.dues.adjusted);
      expect(s.cash.closing).toBe(s.cash.opening + s.cash.collections - s.cash.expenses);
    }
  });
});
