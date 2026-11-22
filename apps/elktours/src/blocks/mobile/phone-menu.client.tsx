"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/mobile/cx";
import { showOnPaths, showsOn, type ShownItem } from "./phone-menu-logic";

const ICONS: Record<string, string> = {
  home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  compass: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm3.5 5.5l-2 5-5 2 2-5z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  pin: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zm0-8.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6z",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3.5 3-6 7-6s7 2.5 7 6zm14-5c3 0 6 1.7 6 5h-4.5",
  chat: "M4 4h16v12H9l-5 4z",
  user: "M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm-8 9c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5z",
};

/**
 * The sticky footer menu as a block (2026-11-21). The same markup and classes as GuestTabBar, so the default draws
 * exactly what the shell's bar draws; `shape` only adds a class. Shown on the pages in `showOn`; inside the studio it is
 * always shown so an author can see it. While this bar is on the page the shell's own bar steps aside (blocks.css).
 */
export function PhoneMenuView({ items, shape, showOn }: { items: ShownItem[]; shape: string; showOn?: string[] }) {
  const pathname = usePathname();
  const paths = showOnPaths(showOn);
  const inStudio = Boolean(pathname && pathname.startsWith("/studio"));
  if (!inStudio && !showsOn(paths, pathname)) return null;
  if (items.length === 0) return null;
  const here = pathname && pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const active = items.find((i) => i.to === here)?.to ?? null;
  const cls = shape === "rounded" || shape === "square" || shape === "flat" ? shape : "pill";
  return (
    <nav data-chrome="nav" className={cx("m-nav", "m-nav-block", "m-nav-shape-" + cls)} aria-label="Main">
      <div data-part="bar" className="m-nav-bar">
        {items.map((t) => {
          const isActive = t.to === active;
          return (
            <Link
              key={t.to + t.label}
              href={t.to}
              data-part={isActive ? "active" : "item"}
              aria-current={isActive ? "page" : undefined}
              className={cx("m-nav-item", isActive && "is-active", t.icon !== "none" && "m-nav-item--icon")}
            >
              {t.icon !== "none" && ICONS[t.icon] ? (
                <svg className="m-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                  <path d={ICONS[t.icon]} />
                </svg>
              ) : null}
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
