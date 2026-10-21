"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { ChartIcon, CloseIcon, DoorIcon, GearIcon, HomeIcon, ListIcon, MenuIcon, ReceiptIcon, ShieldIcon, WalletIcon } from "./icons";
import { cx } from "./ui";

const ICONS = { home: HomeIcon, door: DoorIcon, list: ListIcon, wallet: WalletIcon, receipt: ReceiptIcon, chart: ChartIcon, gear: GearIcon, shield: ShieldIcon };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };
export type NavGroup = { label?: string; items: NavItem[] };

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export function NavLinks({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  return (
    <nav className="space-y-5">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.label ? <div className="mb-1.5 px-3 text-xs font-medium text-muted">{g.label}</div> : null}
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = isActive(path, i.href);
              const Icon = ICONS[i.icon];
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={(e) => e.currentTarget.closest("dialog")?.close()}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                      active ? "bg-surface text-text shadow-xs ring-1 ring-border" : "text-text-2 hover:bg-surface-3/60 hover:text-text",
                    )}
                  >
                    <Icon
                      className={cx("size-[1.125rem] shrink-0 transition-colors", active ? "text-primary" : "text-muted group-hover:text-text-2")}
                      aria-hidden
                    />
                    <span className="truncate">{i.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Top bar + slide-over drawer below the lg breakpoint. */
export function MobileNav({
  brand,
  footer,
  groups,
  menuLabel,
  closeLabel,
}: {
  brand: ReactNode;
  footer: ReactNode;
  groups: NavGroup[];
  menuLabel: string;
  closeLabel: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const path = usePathname();
  useEffect(() => {
    ref.current?.close(); // navigating closes the drawer
  }, [path]);

  return (
    <>
      <div className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-md lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => ref.current?.showModal()}
          className="-me-1.5 grid size-9 place-items-center rounded-lg text-text-2 transition-colors hover:bg-surface-3/60 hover:text-text"
          aria-label={menuLabel}
          aria-haspopup="dialog"
        >
          <MenuIcon className="size-5" />
        </button>
      </div>
      <dialog
        ref={ref}
        className="drawer no-print lg:hidden"
        aria-label={menuLabel}
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close();
        }}
      >
        <div className="flex h-full flex-col rtl:animate-slide-end ltr:animate-slide-start">
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
            {brand}
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="-me-1.5 grid size-9 place-items-center rounded-lg text-text-2 transition-colors hover:bg-surface-3/60 hover:text-text"
              aria-label={closeLabel}
            >
              <CloseIcon className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <NavLinks groups={groups} />
          </div>
          <div className="border-t border-border p-3">{footer}</div>
        </div>
      </dialog>
    </>
  );
}
