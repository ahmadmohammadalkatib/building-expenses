"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { actor, run, str } from "@/lib/actions";
import type { FormState } from "@/components/forms";
import { getDict } from "@/lib/i18n";
import { changeOwner, createApartment, setApartmentArchived, updateApartment, updateOwner } from "@/lib/services/setup";
import { today } from "@/lib/services/common";

function aptInput(fd: FormData) {
  const floor = str(fd, "floor").trim();
  return {
    number: str(fd, "number"),
    floor: floor === "" ? null : Number(floor),
    billingStartMonth: `${str(fd, "billing_start")}-01`,
    notes: str(fd, "notes"),
  };
}
function ownerInput(fd: FormData) {
  return { fullName: str(fd, "owner_name"), phone: str(fd, "owner_phone"), email: str(fd, "owner_email"), notes: "" };
}

export async function createApartmentAction(_: FormState, fd: FormData): Promise<FormState> {
  let id = "";
  const res = await run(async () => {
    const a = await actor();
    const sql = db();
    id = await createApartment(sql, a, aptInput(fd), { ...ownerInput(fd), startDate: await today(sql) });
  });
  if (res?.error) return res;
  revalidatePath("/apartments");
  redirect(`/apartments/${id}`);
}

export async function updateApartmentAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    const id = str(fd, "id");
    await updateApartment(db(), a, id, aptInput(fd));
    revalidatePath(`/apartments/${id}`);
    return { ok: true, message: t.common.saved };
  });
}

export async function archiveAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    const id = str(fd, "id");
    const sql = db();
    await setApartmentArchived(sql, a, id, str(fd, "archive") === "1" ? await today(sql) : null);
    revalidatePath(`/apartments/${id}`);
    revalidatePath("/apartments");
    return { ok: true, message: t.common.saved };
  });
}

export async function changeOwnerAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    const id = str(fd, "id");
    await changeOwner(db(), a, id, ownerInput(fd), str(fd, "start_date"));
    revalidatePath(`/apartments/${id}`);
    return { ok: true, message: t.common.saved };
  });
}

export async function updateOwnerAction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const a = await actor();
    const { t } = await getDict();
    await updateOwner(db(), a, str(fd, "owner_id"), ownerInput(fd));
    revalidatePath(`/apartments/${str(fd, "id")}`);
    return { ok: true, message: t.common.saved };
  });
}
