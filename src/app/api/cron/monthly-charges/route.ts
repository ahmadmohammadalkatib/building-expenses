import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db/client";
import { SYSTEM, today } from "@/lib/services/common";
import { generateMonthlyCharges } from "@/lib/services/ledger";
import { monthStart } from "@/lib/core/dates";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Runs daily (Vercel Cron). Generates the current building-local month's charges if
 * they don't exist yet — idempotent, so daily runs are harmless and self-healing.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sql = db();
  const month = monthStart(await today(sql));
  const r = await generateMonthlyCharges(sql, SYSTEM, month, "cron");
  return NextResponse.json(r);
}
