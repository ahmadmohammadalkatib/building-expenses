import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getDict } from "@/lib/i18n";
import { toPlain } from "@/lib/core/money";
import { isIsoDate, monthStart } from "@/lib/core/dates";
import { csvResponse, toCsv } from "@/lib/csv";
import { today } from "@/lib/services/common";
import {
  apartmentStatement,
  arrearsReport,
  collectionsReport,
  expensesReport,
  monthlySummary,
} from "@/lib/services/reports";

const UUID = /^[0-9a-f-]{36}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { report } = await params;
  const { t, locale } = await getDict();
  const sp = req.nextUrl.searchParams;
  const sql = db();
  const d0 = await today(sql);
  const from = isIsoDate(sp.get("from")) ? sp.get("from")! : monthStart(d0);
  const to = isIsoDate(sp.get("to")) ? sp.get("to")! : d0;
  const methodName = (m: string) => t.methods[m as keyof typeof t.methods] ?? m;
  const catName = (ar: string, en: string) => (locale === "ar" ? ar : en || ar);

  switch (report) {
    case "monthly": {
      const m = /^\d{4}-\d{2}$/.test(sp.get("month") ?? "") ? `${sp.get("month")}-01` : monthStart(d0);
      const r = await monthlySummary(sql, m);
      const rows: (string | number)[][] = [
        [t.reports.cashSection, t.reports.openingCash, toPlain(r.cash.opening)],
        [t.reports.cashSection, t.dashboard.collections, toPlain(r.cash.collections)],
        [t.reports.cashSection, t.dashboard.expenses, toPlain(r.cash.expenses)],
        [t.reports.cashSection, t.reports.closingCash, toPlain(r.cash.closing)],
        [t.reports.duesSection, t.reports.openingDues, toPlain(r.dues.opening)],
        [t.reports.duesSection, t.reports.billed, toPlain(r.dues.billed)],
        [t.reports.duesSection, t.reports.collectedDues, toPlain(r.dues.collected)],
        [t.reports.duesSection, t.reports.adjustedDues, toPlain(r.dues.adjusted)],
        [t.reports.duesSection, t.reports.closingDues, toPlain(r.dues.closing)],
        [t.reports.duesSection, t.reports.creditHeld, toPlain(r.creditHeld)],
        ...r.byCategory.map((c) => [t.reports.byCategory, catName(c.name_ar, c.name_en), toPlain(c.total)]),
      ];
      return csvResponse(`monthly-${m.slice(0, 7)}.csv`, toCsv(["", "", `${t.common.amount} (ILS)`], rows));
    }
    case "statement": {
      const id = sp.get("apartment") ?? "";
      if (!UUID.test(id)) return NextResponse.json({ error: "apartment" }, { status: 400 });
      const [apt] = await sql<{ number: string }[]>`select number from apartments where id = ${id}`;
      const st = await apartmentStatement(sql, id);
      return csvResponse(
        `statement-${apt?.number ?? "apt"}.csv`,
        toCsv(
          [t.common.date, t.dues.kind, t.payments.receiptNo, t.common.description, t.dues.title, t.payments.title, t.apartments.balance],
          st.lines.map((l) => [l.date, l.type, l.ref, l.description, l.debit ? toPlain(l.debit) : "", l.credit ? toPlain(l.credit) : "", toPlain(l.balance)]),
        ),
      );
    }
    case "arrears": {
      const r = await arrearsReport(sql, d0);
      const B = ["current", "d1_30", "d31_60", "d61_90", "d90p"] as const;
      return csvResponse(
        `arrears-${d0}.csv`,
        toCsv(
          [t.common.apartment, t.common.owner, t.common.phone, t.reports.oldestDue, ...B.map((b) => t.reports.aging[b]), t.common.total],
          r.list.map((e) => [e.number, e.ownerName ?? "", e.phone ?? "", e.oldestDue, ...B.map((b) => toPlain(e.buckets[b])), toPlain(e.total)]),
        ),
      );
    }
    case "expenses": {
      const cat = UUID.test(sp.get("category") ?? "") ? sp.get("category") : null;
      const r = await expensesReport(sql, from, to, cat);
      return csvResponse(
        `expenses-${from}-${to}.csv`,
        toCsv(
          [t.common.date, t.expenses.category, t.expenses.vendor, t.common.description, t.common.method, t.common.reference, t.common.amount],
          r.list.map((e) => [e.expense_date, catName(e.category_ar, e.category_en), e.vendor, e.description, methodName(e.method), e.reference, toPlain(e.amount)]),
        ),
      );
    }
    case "collections": {
      const r = await collectionsReport(sql, from, to);
      return csvResponse(
        `collections-${from}-${to}.csv`,
        toCsv(
          [t.payments.receiptNo, t.common.date, t.common.apartment, t.payments.payer, t.common.method, t.common.reference, t.common.amount],
          r.list.map((p) => [p.receipt_no, p.payment_date, p.number, p.payer_name, methodName(p.method), p.reference, toPlain(p.amount)]),
        ),
      );
    }
    default:
      return NextResponse.json({ error: "unknown report" }, { status: 404 });
  }
}
