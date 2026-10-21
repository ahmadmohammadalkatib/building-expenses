// All money is stored and computed as integer agorot (1 ₪ = 100 agorot).
// Only format at the edges (display / CSV).

export type Agorot = number;

/** Parse a user-entered shekel amount ("1,250.5", "١٢٥٠٫٥") into agorot. Returns null if invalid. */
export function parseShekels(input: string | number | null | undefined): Agorot | null {
  if (input === null || input === undefined) return null;
  let s = String(input).trim();
  if (!s) return null;
  // Arabic-Indic and Eastern Arabic-Indic digits → ASCII
  s = s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".") // Arabic decimal separator
    .replace(/[٬,\s₪]/g, ""); // thousands separators, currency sign
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const agorot = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(agorot)) return null;
  return agorot;
}

/** Agorot → "1250.50" (plain, for inputs and CSV). */
export function toPlain(agorot: Agorot): string {
  const sign = agorot < 0 ? "-" : "";
  const abs = Math.abs(agorot);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Agorot → localized currency string. Uses Latin digits for clarity in both languages. */
export function formatMoney(agorot: Agorot, locale: "ar" | "en" = "ar", currency = "ILS"): string {
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: agorot % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return nf.format(agorot / 100);
}
