"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export function Tabs({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <div className="no-print scroll-thin -mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      <nav className="flex gap-5 sm:gap-7">
        {items.map((i) => {
          const active = path === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "-mb-px whitespace-nowrap border-b-2 pb-3 pt-1 text-sm font-medium transition-colors duration-150",
                active ? "border-primary text-text" : "border-transparent text-muted hover:border-border-strong hover:text-text",
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
