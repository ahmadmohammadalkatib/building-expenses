"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export function Tabs({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <div className="no-print -mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      <nav className="flex gap-1">
        {items.map((i) => {
          const active = path === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cx(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm",
                active ? "border-primary font-semibold text-primary" : "border-transparent text-muted hover:text-text",
              )}
            >
              {i.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
