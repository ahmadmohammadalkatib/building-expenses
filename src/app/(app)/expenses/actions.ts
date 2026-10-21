"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { actor, money, run, str } from "@/lib/actions";
import type { FormState } from "@/components/forms";
import { getDict } from "@/lib/i18n";
import { editExpenseDetails, recordExpense, voidExpense, type Method } from "@/lib/services/expenses";
import { AppError, today } from "@/lib/services/common";
import { supabaseServer } from "@/lib/supabase/server";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

async function uploadAttachment(fd: FormData): Promise<string | null> {
  const file = fd.get("attachment");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 5 * 1024 * 1024) throw new AppError("file_too_large");
  const ext = ALLOWED[file.type];
  if (!ext) throw new AppError("upload_failed");
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const supabase = await supabaseServer();
  const { error } = await supabase.storage.from("expense-files").upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error("upload", error);
    throw new AppError("upload_failed");
  }
  return path;
}

export async function recordExpenseAction(_: FormState, fd: FormData): Promise<FormState> {
  let id = "";
  let negative = false;
  const res = await run(async () => {
    const a = await actor();
    const sql = db();
    const amount = money(fd, "amount");
    const attachmentPath = await uploadAttachment(fd);
    const r = await recordExpense(
      sql,
      a,
      {
        categoryId: str(fd, "category_id"),
        amount,
        date: str(fd, "date"),
        vendor: str(fd, "vendor"),
        description: str(fd, "description"),
        method: str(fd, "method") as Method,
        reference: str(fd, "reference"),
        attachmentPath,
        idempotencyKey: str(fd, "idempotency_key"),
      },
      await today(sql),
    );
    id = r.id;
    negative = r.negativeBalance;
  });
  if (res?.error) return res;
  revalidatePath("/", "layout");
  redirect(`/expenses/${id}?new=1${negative ? "&neg=1" : ""}`);
}

export async function voidExpenseAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    const id = str(fd, "id");
    await voidExpense(db(), a, id, str(fd, "reason"));
    revalidatePath(`/expenses/${id}`);
    return { ok: true, message: t.common.saved };
  });
}

export async function editExpenseAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    const id = str(fd, "id");
    const attachmentPath = await uploadAttachment(fd);
    await editExpenseDetails(db(), a, id, {
      categoryId: str(fd, "category_id"),
      vendor: str(fd, "vendor"),
      description: str(fd, "description"),
      method: str(fd, "method") as Method,
      reference: str(fd, "reference"),
      ...(attachmentPath ? { attachmentPath } : {}),
    });
    revalidatePath(`/expenses/${id}`);
    return { ok: true, message: t.common.saved };
  });
}
