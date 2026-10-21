import { formatMoney, toPlain } from "@/lib/core/money";
import { formatDate, formatMonth } from "@/lib/core/dates";
import type { Locale } from "@/lib/i18n";

export function formatters(locale: Locale) {
  return {
    money: (a: number) => formatMoney(a, locale),
    plain: toPlain,
    date: (d: string | null | undefined) => (d ? formatDate(d.slice(0, 10), locale) : "—"),
    month: (m: string) => formatMonth(m, locale),
    dateTime: (iso: string) =>
      new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Hebron",
      }).format(new Date(iso)),
  };
}
