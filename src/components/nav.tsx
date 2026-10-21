"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartIcon, DoorIcon, GearIcon, HomeIcon, ListIcon, ReceiptIcon, ShieldIcon, WalletIcon } from "./icons";
import { cx } from "./ui";

const ICONS = { home: HomeIcon, door: DoorIcon, list: ListIcon, wallet: WalletIcon, receipt: ReceiptIcon, chart: ChartIcon, gear: GearIcon, shield: ShieldIcon };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="space-y-0.5">
      {items.map((i) => {
        const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
        const Icon = ICONS[i.icon];
        return (
          <Link
            key={i.href}
            href={i.href}
            onClick={(e) => (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open")}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
              active ? "bg-primary-soft font-semibold text-primary" : "text-text hover:bg-surface-2",
            )}
          >
            <Icon className="size-5 shrink-0" />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
