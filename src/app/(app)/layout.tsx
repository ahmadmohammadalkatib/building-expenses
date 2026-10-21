import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { MobileNav, NavLinks, type NavGroup } from "@/components/nav";
import { BuildingIcon, LanguageIcon, LogOutIcon } from "@/components/icons";
import { signOut, toggleLocale } from "../session-actions";
import { db } from "@/lib/db/client";
import { getSettings } from "@/lib/services/common";
import { initials } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser({ allowPasswordChange: true });
  const { t } = await getDict();
  const s = await getSettings(db());
  const groups: NavGroup[] = [
    { items: [{ href: "/", label: t.nav.dashboard, icon: "home" }] },
    {
      label: t.nav.groups.ledger,
      items: [
        { href: "/apartments", label: t.nav.apartments, icon: "door" },
        { href: "/dues", label: t.nav.dues, icon: "list" },
        { href: "/payments", label: t.nav.payments, icon: "wallet" },
        { href: "/expenses", label: t.nav.expenses, icon: "receipt" },
        { href: "/reports", label: t.nav.reports, icon: "chart" },
      ],
    },
    ...(can(user, "admin")
      ? [
          {
            label: t.nav.groups.admin,
            items: [
              { href: "/settings", label: t.nav.settings, icon: "gear" },
              { href: "/audit", label: t.nav.audit, icon: "shield" },
            ],
          } satisfies NavGroup,
        ]
      : []),
  ];
  const name = user.fullName || user.email;
  const quiet =
    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[0.8125rem] text-muted transition-colors hover:bg-surface-3/60 hover:text-text";
  const footer = (
    <div className="space-y-1">
      <Link href="/account" className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-3/60">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-ink" aria-hidden>
          {initials(name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted">{t.roles[user.role]}</span>
        </span>
      </Link>
      <div className="flex gap-1">
        <form action={toggleLocale} className="flex-1">
          <button className={quiet}>
            <LanguageIcon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{t.common.language}</span>
          </button>
        </form>
        <form action={signOut}>
          <button className={`${quiet} hover:text-danger`} aria-label={t.nav.logout} title={t.nav.logout}>
            <LogOutIcon className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
  const brand = (
    <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-ink shadow-xs">
        <BuildingIcon className="size-[1.125rem]" aria-hidden />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold">{s.building_name || t.app.short}</span>
        {s.building_name ? <span className="block truncate text-xs text-muted">{t.app.short}</span> : null}
      </span>
    </Link>
  );
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-e border-border lg:flex">
        <div className="px-5 pb-5 pt-6">{brand}</div>
        <div className="flex-1 overflow-y-auto px-3">
          <NavLinks groups={groups} />
        </div>
        <div className="border-t border-border p-3">{footer}</div>
      </aside>
      <MobileNav brand={brand} footer={footer} groups={groups} menuLabel={t.nav.menu} closeLabel={t.common.close} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
