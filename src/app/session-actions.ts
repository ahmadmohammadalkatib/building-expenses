"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { run, str } from "@/lib/actions";
import type { FormState } from "@/components/forms";
import { getDict } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { changeOwnPassword } from "@/lib/services/users";

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const { t } = await getDict();
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(fd, "email").trim().toLowerCase(),
    password: str(fd, "password"),
  });
  if (error) return { error: t.auth.invalid };
  const u = await currentUser();
  if (!u) {
    await supabase.auth.signOut();
    return { error: t.auth.noAccess };
  }
  redirect(u.mustChangePassword ? "/account?must=1" : "/");
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function toggleLocale() {
  const store = await cookies();
  const cur = store.get(LOCALE_COOKIE)?.value === "en" ? "en" : "ar";
  store.set(LOCALE_COOKIE, cur === "ar" ? "en" : "ar", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const { t } = await getDict();
  const u = await currentUser();
  if (!u) redirect("/login");
  const pw = str(fd, "password");
  if (pw !== str(fd, "confirm")) return { error: t.auth.mismatch };
  const res = await run(async () => {
    await changeOwnPassword(db(), u, pw);
  });
  if (res?.error) return res;
  redirect("/?pw=1");
}
