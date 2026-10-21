"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { actor, money, run, str } from "@/lib/actions";
import type { FormState } from "@/components/forms";
import { getDict } from "@/lib/i18n";
import { parseShekels } from "@/lib/core/money";
import { editPaymentDetails, previewPayment, recordPayment, voidPayment, type NewPayment } from "@/lib/services/ledger";
import { today } from "@/lib/services/common";
import { currentUser } from "@/lib/auth";

export async function previewAction(apartmentId: string, amountText: string) {
  const u = await currentUser();
  if (!u || !/^[0-9a-f-]{36}$/.test(apartmentId)) return null;
  const amount = parseShekels(amountText) ?? 0;
  return previewPayment(db(), apartmentId, amount);
}

export async function recordPaymentAction(_: FormState, fd: FormData): Promise<FormState> {
  let id = "";
  const res = await run(async () => {
    const a = await actor();
    const sql = db();
    const r = await recordPayment(
      sql,
      a,
      {
        apartmentId: str(fd, "apartment_id"),
        amount: money(fd, "amount"),
        date: str(fd, "date"),
        method: str(fd, "method") as NewPayment["method"],
        payerName: str(fd, "payer_name"),
        reference: str(fd, "reference"),
        notes: str(fd, "notes"),
        idempotencyKey: str(fd, "idempotency_key"),
      },
      await today(sql),
    );
    id = r.id;
  });
  if (res?.error) return res;
  revalidatePath("/", "layout");
  redirect(`/payments/${id}?new=1`);
}

export async function voidPaymentAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    const id = str(fd, "id");
    await voidPayment(db(), a, id, str(fd, "reason"));
    revalidatePath(`/payments/${id}`);
    return { ok: true, message: t.common.saved };
  });
}

export async function editPaymentAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    const id = str(fd, "id");
    await editPaymentDetails(db(), a, id, {
      payerName: str(fd, "payer_name"),
      reference: str(fd, "reference"),
      notes: str(fd, "notes"),
      method: str(fd, "method") as NewPayment["method"],
    });
    revalidatePath(`/payments/${id}`);
    return { ok: true, message: t.common.saved };
  });
}
