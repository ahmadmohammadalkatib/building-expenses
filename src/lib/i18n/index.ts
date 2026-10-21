import { cookies } from "next/headers";
import ar, { type Dict } from "./ar";
import en from "./en";

export type Locale = "ar" | "en";
export type { Dict };

export const LOCALE_COOKIE = "locale";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  return c === "en" ? "en" : "ar";
}

export function dictFor(locale: Locale): Dict {
  return locale === "en" ? en : ar;
}

export async function getDict(): Promise<{ t: Dict; locale: Locale }> {
  const locale = await getLocale();
  return { t: dictFor(locale), locale };
}

/** "Created {n} charges" + {n: 3} */
export function fmt(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

export function errorText(t: Dict, code: string, params: Record<string, string | number> = {}): string {
  const msg = (t.errors as Record<string, string>)[code] ?? t.errors.generic;
  return fmt(msg, params);
}
