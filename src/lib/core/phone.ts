import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/** Normalize to E.164 (+970… / +972…). Local numbers default to Palestine (PS). */
export function normalizePhone(input: string, defaultCountry: CountryCode = "PS"): string | null {
  const s = input
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  if (!s) return null;
  const p = parsePhoneNumberFromString(s, defaultCountry);
  return p && p.isPossible() ? p.number : null;
}

export function whatsappLink(e164: string, text?: string): string {
  const n = e164.replace(/[^\d]/g, "");
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
