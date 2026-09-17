"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface TabItem {
  href: string;
  label: string;
  /** Shown as a small count badge, e.g. unread messages or items needing action. */
  count?: number;
}

/**
 * The underlined-tab pattern for a console split across routes (Studio,
 * Admin). Each tab is a real page — a full navigation, not client-side
 * show/hide — so each tab only fetches what it renders.
 */
export function TabNav({ tabs }: { tabs: TabItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="mb-8 flex flex-wrap gap-x-1 border-b border-border">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {!!tab.count && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-xs font-medium text-muted-foreground">
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
