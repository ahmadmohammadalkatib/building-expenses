"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { actor, money, run, str } from "@/lib/actions";
import type { FormState } from "@/components/forms";
import { fmt, getDict } from "@/lib/i18n";
import { formatMonth } from "@/lib/core/dates";
import { addAdjustment, createCharge, generateMonthlyCharges, voidAdjustment, voidCharge } from "@/lib/services/ledger";
import { AppError, today } from "@/lib/services/common";

export async function generateAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t, locale } = await getDict();
    const sql = db();
    const month = `${str(fd, "month")}-01`;
    if (month.slice(0, 7) > (await today(sql)).slice(0, 7)) throw new AppError("date_future");
    const r = await generateMonthlyCharges(sql, a, month, "manual");
    revalidatePath("/dues");
    const m = formatMonth(r.month, locale);
    return { ok: true, message: r.created ? fmt(t.dues.generated, { n: r.created, month: m }) : fmt(t.dues.nothingToGenerate, { month: m }) };
  });
}

export async function createChargeAction(_: FormState, fd: FormData): Promise<FormState> {
  let id = "";
  const res = await run(async () => {
    const a = await actor();
    id = await createCharge(db(), a, {
      apartmentId: str(fd, "apartment_id"),
      kind: str(fd, "kind") as "special" | "other",
      billingMonth: `${str(fd, "month")}-01`,
      dueDate: str(fd, "due_date"),
      amount: money(fd, "amount"),
      description: str(fd, "description"),
    });
  });
  if (res?.error) return res;
  revalidatePath("/dues");
  redirect(`/dues/${id}`);
}

export async function voidChargeAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    const id = str(fd, "id");
    await voidCharge(db(), a, id, str(fd, "reason"));
    revalidatePath(`/dues/${id}`);
    return { ok: true, message: t.common.saved };
  });
}

export async function adjustAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    const id = str(fd, "id");
    await addAdjustment(db(), a, {
      chargeId: id,
      kind: str(fd, "kind") as "waiver" | "discount" | "correction",
      amount: money(fd, "amount"),
      date: str(fd, "date"),
      reason: str(fd, "reason"),
    });
    revalidatePath(`/dues/${id}`);
    return { ok: true, message: t.common.saved };
  });
}

export async function voidAdjustmentAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    await voidAdjustment(db(), a, str(fd, "adjustment_id"), str(fd, "reason"));
    revalidatePath(`/dues/${str(fd, "id")}`);
    return { ok: true, message: t.common.saved };
  });
}
