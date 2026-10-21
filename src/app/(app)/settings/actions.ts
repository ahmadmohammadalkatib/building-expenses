"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { actor, money, newKey, run, str } from "@/lib/actions";
import type { FormState } from "@/components/forms";
import { getDict } from "@/lib/i18n";
import { addFee, deleteFee, saveCategory, setOpeningArrears, updateFee, updateSettings } from "@/lib/services/setup";
import { createUser, resetUserPassword, updateUser } from "@/lib/services/users";
import { recordPayment } from "@/lib/services/ledger";
import { AppError, getSettings, today, type Role } from "@/lib/services/common";
import { parseShekels } from "@/lib/core/money";

export async function saveSettingsAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    const ob = parseShekels(str(fd, "opening_balance") || "0");
    if (ob === null && str(fd, "opening_balance")) throw new AppError("invalid_amount");
    const neg = fd.get("opening_negative") === "on";
    await updateSettings(db(), a, {
      building_name: str(fd, "building_name"),
      building_address: str(fd, "building_address"),
      opening_balance: (ob ?? 0) * (neg ? -1 : 1),
      opening_date: str(fd, "opening_date") || null,
      due_day: Number(str(fd, "due_day") || 10),
      timezone: str(fd, "timezone") || "Asia/Hebron",
      receipt_prefix: str(fd, "receipt_prefix") || "R",
      receipt_footer: str(fd, "receipt_footer"),
    });
    revalidatePath("/", "layout");
    return { ok: true, message: t.common.saved };
  });
}

export async function addFeeAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    const sql = db();
    await addFee(
      sql,
      a,
      {
        apartmentId: str(fd, "apartment_id") || null,
        amount: money(fd, "amount"),
        effectiveFrom: `${str(fd, "month")}-01`,
        note: str(fd, "note"),
        applyToIssued: fd.get("apply") === "on",
      },
      await today(sql),
    );
    revalidatePath("/", "layout");
    revalidatePath("/settings/fees");
    return { ok: true, message: t.common.saved };
  });
}

export async function saveCategoryAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    await saveCategory(db(), a, {
      id: str(fd, "id") || undefined,
      nameAr: str(fd, "name_ar"),
      nameEn: str(fd, "name_en"),
      archived: fd.get("archived") === "on",
      sort: Number(str(fd, "sort") || 50),
    });
    revalidatePath("/settings/categories");
    return { ok: true, message: t.common.saved };
  });
}

export async function createUserAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    await createUser(db(), a, {
      email: str(fd, "email"),
      fullName: str(fd, "full_name"),
      role: str(fd, "role") as Role,
      tempPassword: str(fd, "password"),
    });
    revalidatePath("/settings/users");
    return { ok: true, message: t.common.saved };
  });
}

export async function updateUserAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    await updateUser(db(), a, str(fd, "id"), {
      fullName: str(fd, "full_name"),
      role: str(fd, "role") as Role,
      active: fd.get("active") === "on",
    });
    const pw = str(fd, "password");
    if (pw) await resetUserPassword(db(), a, str(fd, "id"), pw);
    revalidatePath("/settings/users");
    return { ok: true, message: t.common.saved };
  });
}

export async function openingBalanceAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    const sql = db();
    const s = await getSettings(sql);
    if (!s.opening_date) throw new AppError("opening_not_set");
    const apartmentId = str(fd, "apartment_id");
    const amount = money(fd, "amount");
    if (str(fd, "type") === "credit") {
      await recordPayment(
        sql,
        a,
        {
          apartmentId,
          amount,
          date: s.opening_date,
          method: "other",
          payerName: "",
          reference: "",
          notes: str(fd, "note"),
          idempotencyKey: newKey(),
          kind: "opening_credit",
        },
        await today(sql),
      );
    } else {
      await setOpeningArrears(sql, a, apartmentId, amount);
    }
    revalidatePath("/settings/opening");
    return { ok: true, message: t.common.saved };
  });
}

export async function updateFeeAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    const sql = db();
    await updateFee(sql, a, str(fd, "id"), { amount: money(fd, "amount"), note: str(fd, "note"), applyToIssued: fd.get("apply") === "on" }, await today(sql));
    revalidatePath("/", "layout");
    return { ok: true, message: t.common.saved };
  });
}

export async function deleteFeeAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    const sql = db();
    await deleteFee(sql, a, str(fd, "id"), fd.get("apply") === "on", await today(sql));
    revalidatePath("/", "layout");
    return { ok: true, message: t.common.saved };
  });
}
