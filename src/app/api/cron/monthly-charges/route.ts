import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db/client";
import { SYSTEM, today } from "@/lib/services/common";
import { catchUpCharges } from "@/lib/services/ledger";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Runs daily (Vercel Cron). Creates any missing monthly charges up to the current building-local
 * month — idempotent, so daily runs are harmless and self-healing.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sql = db();
  const r = await catchUpCharges(sql, SYSTEM, await today(sql), "cron");
  return NextResponse.json(r);
}
