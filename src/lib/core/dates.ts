// Calendar dates are plain "YYYY-MM-DD" strings (Postgres DATE). Months are "YYYY-MM-01".
// "Today" is always computed in the building's time zone.

export const DEFAULT_TZ = "Asia/Hebron";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Today's calendar date in the given IANA time zone. */
export function todayIn(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(month: string, n: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + n;
  const ny = y + Math.floor(m / 12);
  const nm = ((m % 12) + 12) % 12;
  return `${String(ny).padStart(4, "0")}-${String(nm + 1).padStart(2, "0")}-01`;
}

export function monthEnd(month: string): string {
  const next = new Date(`${addMonths(month, 1)}T00:00:00Z`);
  next.setUTCDate(0);
  return next.toISOString().slice(0, 10);
}

/** Day `day` of the month, clamped to the month's length (e.g. 31 → 30 Apr). */
export function dayOfMonth(month: string, day: number): string {
  const last = Number(monthEnd(month).slice(8, 10));
  return `${month.slice(0, 7)}-${String(Math.min(Math.max(day, 1), last)).padStart(2, "0")}`;
}

/** Inclusive list of months from `from` to `to`. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = monthStart(from); m <= monthStart(to); m = addMonths(m, 1)) out.push(m);
  return out;
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

export function formatMonth(month: string, locale: "ar" | "en" = "ar"): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${monthStart(month)}T00:00:00Z`));
}

export function formatDate(date: string, locale: "ar" | "en" = "ar"): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
