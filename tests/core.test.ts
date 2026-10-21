import { describe, expect, it } from "vitest";
import { formatMoney, parseShekels, toPlain } from "@/lib/core/money";
import { addMonths, dayOfMonth, isIsoDate, monthEnd, monthsBetween, todayIn } from "@/lib/core/dates";
import {
  agingBucket,
  allocate,
  applyCredit,
  canFeeStartIn,
  chargeState,
  checkTransactionDate,
  feeForMonth,
  formatReceiptNo,
  fundBalance,
  periodCash,
  planMonthlyCharges,
  type FeeRate,
  type OpenCharge,
} from "@/lib/core/accounting";
import { normalizePhone, whatsappLink } from "@/lib/core/phone";

describe("money", () => {
  it("parses shekel input into integer agorot", () => {
    expect(parseShekels("100")).toBe(10000);
    expect(parseShekels("1,250.5")).toBe(125050);
    expect(parseShekels("0.01")).toBe(1);
    expect(parseShekels("١٢٥٠٫٥")).toBe(125050);
    expect(parseShekels("₪ 300")).toBe(30000);
    expect(parseShekels("1.234")).toBeNull();
    expect(parseShekels("-5")).toBeNull();
    expect(parseShekels("abc")).toBeNull();
    expect(parseShekels("")).toBeNull();
  });
  it("never uses floating point for sums", () => {
    // 0.1 + 0.2 problem does not exist in agorot
    expect(parseShekels("0.1")! + parseShekels("0.2")!).toBe(30);
  });
  it("formats", () => {
    expect(toPlain(125050)).toBe("1250.50");
    expect(toPlain(-5)).toBe("-0.05");
    expect(formatMoney(75000, "en")).toBe("₪750");
    expect(formatMoney(75050, "en")).toBe("₪750.50");
  });
});

describe("dates", () => {
  it("handles month arithmetic", () => {
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(monthEnd("2028-02-01")).toBe("2028-02-29");
    expect(dayOfMonth("2026-04-01", 31)).toBe("2026-04-30");
    expect(monthsBetween("2026-01-15", "2026-03-02")).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
  });
  it("computes today in the building time zone", () => {
    // 22:30 UTC on Oct 20 is already Oct 21 in Hebron (UTC+3)
    expect(todayIn("Asia/Hebron", new Date("2026-10-20T22:30:00Z"))).toBe("2026-10-21");
    expect(todayIn("UTC", new Date("2026-10-20T22:30:00Z"))).toBe("2026-10-20");
  });
});

describe("fees", () => {
  const rates: FeeRate[] = [
    { apartmentId: null, amount: 10000, effectiveFrom: "2026-01-01" },
    { apartmentId: null, amount: 15000, effectiveFrom: "2026-06-01" },
    { apartmentId: "A2", amount: 5000, effectiveFrom: "2026-03-01" },
  ];
  it("uses effective-dated building rate", () => {
    expect(feeForMonth(rates, "A1", "2026-05-01")).toBe(10000);
    expect(feeForMonth(rates, "A1", "2026-06-01")).toBe(15000);
    expect(feeForMonth(rates, "A1", "2025-12-01")).toBeNull();
  });
  it("apartment override wins once effective", () => {
    expect(feeForMonth(rates, "A2", "2026-02-01")).toBe(10000);
    expect(feeForMonth(rates, "A2", "2026-07-01")).toBe(5000);
  });
  it("fee changes only for months not yet generated", () => {
    const gen = new Set(["2026-10-01"]);
    expect(canFeeStartIn("2026-10-01", gen)).toBe(false);
    expect(canFeeStartIn("2026-11-01", gen)).toBe(true);
  });
});

describe("monthly charge generation", () => {
  const rates: FeeRate[] = [{ apartmentId: null, amount: 10000, effectiveFrom: "2026-01-01" }];
  const apts = [
    { id: "A1", billingStartMonth: "2026-01-01", archivedAt: null },
    { id: "A2", billingStartMonth: "2026-11-01", archivedAt: null }, // added on the 20th of Oct → billed from Nov
    { id: "A3", billingStartMonth: "2026-01-01", archivedAt: "2026-08-15" },
  ];
  it("charges eligible apartments a full month", () => {
    const plan = planMonthlyCharges(apts, rates, "2026-10-01", new Set());
    expect(plan).toEqual([{ apartmentId: "A1", billingMonth: "2026-10-01", amount: 10000 }]);
  });
  it("is idempotent: existing charges are skipped", () => {
    expect(planMonthlyCharges(apts, rates, "2026-10-01", new Set(["A1"]))).toEqual([]);
  });
  it("still charges the month an apartment was archived in", () => {
    expect(planMonthlyCharges(apts, rates, "2026-08-01", new Set()).map((c) => c.apartmentId)).toEqual(["A1", "A3"]);
  });
});

describe("allocation", () => {
  const charges: OpenCharge[] = [
    { id: "c-mar", dueDate: "2026-03-10", billingMonth: "2026-03-01", createdAt: "2026-03-01T00:00:00Z", outstanding: 10000 },
    { id: "c-jan", dueDate: "2026-01-10", billingMonth: "2026-01-01", createdAt: "2026-01-01T00:00:00Z", outstanding: 10000 },
    { id: "c-feb", dueDate: "2026-02-10", billingMonth: "2026-02-01", createdAt: "2026-02-01T00:00:00Z", outstanding: 4000 },
  ];
  it("pays oldest first and partially pays the last", () => {
    expect(allocate(17000, charges)).toEqual({
      lines: [
        { chargeId: "c-jan", amount: 10000 },
        { chargeId: "c-feb", amount: 4000 },
        { chargeId: "c-mar", amount: 3000 },
      ],
      credit: 0,
    });
  });
  it("leaves overpayment as credit", () => {
    const r = allocate(30000, charges);
    expect(r.lines.reduce((s, l) => s + l.amount, 0)).toBe(24000);
    expect(r.credit).toBe(6000);
  });
  it("breaks ties by billing month then creation time", () => {
    const tie: OpenCharge[] = [
      { id: "b", dueDate: "2026-01-10", billingMonth: "2026-01-01", createdAt: "2026-01-02T00:00:00Z", outstanding: 100 },
      { id: "a", dueDate: "2026-01-10", billingMonth: "2026-01-01", createdAt: "2026-01-01T00:00:00Z", outstanding: 100 },
    ];
    expect(allocate(100, tie).lines).toEqual([{ chargeId: "a", amount: 100 }]);
  });
  it("applies credit from oldest payments to oldest charges", () => {
    const lines = applyCredit(
      [
        { paymentId: "p2", paymentDate: "2026-02-01", createdAt: "x", remaining: 5000 },
        { paymentId: "p1", paymentDate: "2026-01-01", createdAt: "x", remaining: 3000 },
      ],
      [{ id: "c", dueDate: "2026-04-10", billingMonth: "2026-04-01", createdAt: "x", outstanding: 6000 }],
    );
    expect(lines).toEqual([
      { paymentId: "p1", chargeId: "c", amount: 3000 },
      { paymentId: "p2", chargeId: "c", amount: 3000 },
    ]);
  });
});

describe("charge status", () => {
  it("separates payment status from overdue flag", () => {
    expect(chargeState(10000, 0, 0, "2026-10-10", "2026-10-05")).toEqual({ status: "unpaid", overdue: false, outstanding: 10000 });
    expect(chargeState(10000, 4000, 0, "2026-10-10", "2026-10-20")).toEqual({ status: "partial", overdue: true, outstanding: 6000 });
    expect(chargeState(10000, 4000, 6000, "2026-10-10", "2026-10-20")).toEqual({ status: "paid", overdue: false, outstanding: 0 });
  });
});

describe("cash ledger", () => {
  it("never mixes cash with dues (₪750 cash, ₪300 dues)", () => {
    // opening 500, payment 400, expense 150 → cash 750. Dues are tracked separately.
    const cash = fundBalance(50000, [
      { date: "2026-01-05", amount: 40000 },
      { date: "2026-01-06", amount: -15000 },
    ]);
    expect(cash).toBe(75000);
  });
  it("summarizes a period", () => {
    const p = periodCash(
      100000,
      "2026-01-01",
      [{ date: "2026-01-15", amount: 20000 }, { date: "2026-02-03", amount: 30000 }],
      [{ date: "2026-01-20", amount: 5000 }, { date: "2026-02-10", amount: 8000 }],
      "2026-02-01",
      "2026-02-28",
    );
    expect(p).toEqual({ openingBalance: 115000, collections: 30000, expenses: 8000, closingBalance: 137000 });
  });
  it("guards transaction dates", () => {
    expect(checkTransactionDate("2025-12-31", "2026-01-01", "2026-10-21")).toBe("before_opening");
    expect(checkTransactionDate("2026-10-22", "2026-01-01", "2026-10-21")).toBe("future");
    expect(checkTransactionDate("2026-01-01", "2026-01-01", "2026-10-21")).toBe("ok");
  });
});

describe("misc", () => {
  it("aging buckets", () => {
    expect(agingBucket(0)).toBe("current");
    expect(agingBucket(30)).toBe("d1_30");
    expect(agingBucket(91)).toBe("d90p");
  });
  it("receipt numbers", () => {
    expect(formatReceiptNo("R", 2026, 1)).toBe("R-2026-0001");
  });
  it("phones are normalized to international format", () => {
    expect(normalizePhone("0599123456")).toBe("+970599123456");
    expect(normalizePhone("+972 52 123 4567")).toBe("+972521234567");
    expect(normalizePhone("123")).toBeNull();
    expect(whatsappLink("+970599123456")).toBe("https://wa.me/970599123456");
  });
});
