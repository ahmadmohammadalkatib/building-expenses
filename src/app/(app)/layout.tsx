import { requireUser, can } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { NavLinks, type NavItem } from "@/components/nav";
import { BuildingIcon } from "@/components/icons";
import { signOut, toggleLocale } from "../session-actions";
import { db } from "@/lib/db/client";
import { getSettings } from "@/lib/services/common";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser({ allowPasswordChange: true });
  const { t } = await getDict();
  const s = await getSettings(db());
  const items: NavItem[] = [
    { href: "/", label: t.nav.dashboard, icon: "home" },
    { href: "/apartments", label: t.nav.apartments, icon: "door" },
    { href: "/dues", label: t.nav.dues, icon: "list" },
    { href: "/payments", label: t.nav.payments, icon: "wallet" },
    { href: "/expenses", label: t.nav.expenses, icon: "receipt" },
    { href: "/reports", label: t.nav.reports, icon: "chart" },
    ...(can(user, "admin")
      ? ([
          { href: "/settings", label: t.nav.settings, icon: "gear" },
          { href: "/audit", label: t.nav.audit, icon: "shield" },
        ] as NavItem[])
      : []),
  ];
  const footer = (
    <div className="space-y-1 border-t border-border pt-3 text-sm">
      <a href="/account" className="block truncate rounded-lg px-3 py-2 hover:bg-surface-2">
        <div className="font-medium">{user.fullName || user.email}</div>
        <div className="text-xs text-muted">{t.roles[user.role]}</div>
      </a>
      <form action={toggleLocale}>
        <button className="w-full rounded-lg px-3 py-2 text-start text-muted hover:bg-surface-2">{t.common.language}</button>
      </form>
      <form action={signOut}>
        <button className="w-full rounded-lg px-3 py-2 text-start text-muted hover:bg-surface-2">{t.nav.logout}</button>
      </form>
    </div>
  );
  const brand = (
    <div className="flex items-center gap-2 px-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-ink">
        <BuildingIcon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{s.building_name || t.app.short}</div>
      </div>
    </div>
  );
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 border-e border-border bg-surface p-3 lg:flex">
        {brand}
        <NavLinks items={items} />
        <div className="mt-auto">{footer}</div>
      </aside>
      <details className="no-print group sticky top-0 z-20 border-b border-border bg-surface lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
          {brand}
          <span className="rounded-lg border border-border px-3 py-1 text-sm">{t.nav.menu}</span>
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <NavLinks items={items} />
          {footer}
        </div>
      </details>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
