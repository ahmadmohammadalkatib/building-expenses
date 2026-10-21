import "server-only";
import { unstable_rethrow } from "next/navigation";
import { AppError } from "@/lib/services/common";
import { errorText, getDict } from "@/lib/i18n";
import type { FormState } from "@/components/forms";
import { parseShekels } from "@/lib/core/money";

/** Run a mutation and turn AppErrors into a localized form error. */
export async function run(fn: () => Promise<FormState | void>): Promise<FormState> {
  try {
    const r = await fn();
    return r ?? { ok: true };
  } catch (e) {
    unstable_rethrow(e); // let Next.js redirects/notFound through
    const { t } = await getDict();
    if (e instanceof AppError) return { error: errorText(t, e.code, e.params) };
    console.error(e);
    return { error: t.errors.generic };
  }
}

export function str(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
}

export function money(fd: FormData, k: string): number {
  const v = parseShekels(str(fd, k));
  if (v === null) throw new AppError("invalid_amount");
  return v;
}

/** The signed-in user as an Actor for service calls (server actions). */
export async function actor() {
  const { currentUser } = await import("@/lib/auth");
  const u = await currentUser();
  if (!u || u.mustChangePassword) throw new AppError("forbidden");
  return u;
}

export function newKey(): string {
  return crypto.randomUUID();
}
