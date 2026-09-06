"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/hub/elkdonis", label: "Elkdonis" },
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
    </div>
  );
}
