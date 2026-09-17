"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The console's nav. A client component only because the current tab has to be
 * marked, and `usePathname` is the cheapest way to know which one that is
 * without every page passing its own key up to the layout.
 */
const TABS = [
  { href: "/manage", label: "Overview" },
  { href: "/manage/directory", label: "Artists & dealers" },
  { href: "/manage/people", label: "People & access" },
  { href: "/manage/sections", label: "Site copy & events" },
];

export function ManageTabs() {
  // `?? ""` because usePathname is null outside a Next router (and in a
  // server render of this component on its own) — `null.startsWith` would throw.
  const pathname = usePathname() ?? "";

  return (
    <nav className="manage-tabs" aria-label="Manage sections">
      {TABS.map((tab) => {
        // Exact match for the overview, prefix for the rest — otherwise
        // "/manage" would light up on every child route.
        const current = tab.href === "/manage" ? pathname === "/manage" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={current ? "manage-tab is-current" : "manage-tab"}
            aria-current={current ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
