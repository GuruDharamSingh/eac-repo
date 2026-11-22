"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./cx";

export type GuestTab = "discover" | "tours" | "experiences";

const TABS: Array<{ key: GuestTab; href: string; label: string }> = [
  { key: "discover", href: "/", label: "Discover" },
  { key: "tours", href: "/tours", label: "Tours" },
  { key: "experiences", href: "/experiences", label: "Experiences" },
];

function tabForPath(pathname: string | null): GuestTab | null {
  if (!pathname) return null;
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return TABS.find((t) => t.href === p)?.key ?? null;
}

/**
 * Floating bottom nav for guests. Renders only on the three root paths.
 * `data-chrome="nav"` and the `data-part` names are what Site style's
 * chrome.nav entry styles (bar, item, active, badge).
 * It stays hidden by CSS until the page has a mobile tree (.elk-m), see mobile.css.
 */
export function GuestTabBar({ active, badge }: { active?: GuestTab; badge?: Partial<Record<GuestTab, number>> }) {
  const here = tabForPath(usePathname());
  if (!here) return null;
  const current = active ?? here;
  return (
    <nav data-chrome="nav" className="m-nav" aria-label="Main">
      <div data-part="bar" className="m-nav-bar">
        {TABS.map((t) => {
          const isActive = t.key === current;
          const n = badge?.[t.key];
          return (
            <Link
              key={t.key}
              href={t.href}
              data-part={isActive ? "active" : "item"}
              aria-current={isActive ? "page" : undefined}
              className={cx("m-nav-item", isActive && "is-active")}
            >
              {t.label}
              {n ? <span data-part="badge" className="m-nav-badge">{n}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
