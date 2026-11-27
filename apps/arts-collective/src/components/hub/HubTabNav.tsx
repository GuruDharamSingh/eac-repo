"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/hub/arts-collective", label: "Arts Collective" },
  { href: "/hub/organization", label: "Organization" },
  { href: "/hub/network", label: "Community" },
] as const;

export function HubTabNav() {
  const pathname = usePathname();

  return (
    <div className="-mx-6 flex gap-1 border-b border-border/60 px-6">
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href) ?? false;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative px-4 py-3 text-sm font-medium tracking-wide transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {active && (
              <span className="absolute inset-x-4 -bottom-px h-0.5 bg-foreground" />
            )}
          </Link>
        );
      })}
      {/* Channel lives outside /hub; a link, not a tab (2026-11-25). */}
      <Link
        href="/channel"
        aria-label="Channel"
        title="Channel"
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 px-2 py-3 text-sm font-medium tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:px-4"
      >
        <Radio size={15} aria-hidden />
        {/* Icon only on phones: the three tabs already fill 390px. */}
        <span className="hidden sm:inline">Channel</span>
      </Link>
    </div>
  );
}
