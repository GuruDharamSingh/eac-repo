"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SiteHeaderProps {
  signedIn: boolean;
  canEdit: boolean;
}

/**
 * Nav is a fixed list, not org_feeds.
 *
 * The amrit-canada template drives its nav from the feeds table because that
 * site's sections are editorial and change. Pigeonshoot's surfaces are product
 * — there will never be a fifth one that an owner adds from a CMS screen — so
 * hardcoding them keeps the layout off the database's critical path.
 */
const NAV = [
  { href: "/cards", label: "Cards" },
  { href: "/map", label: "Map" },
  { href: "/species", label: "Species" },
  { href: "/places", label: "Places" },
];

export function SiteHeader({ signedIn, canEdit }: SiteHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          Pigeon<span className="text-primary">shoot</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/submit">
              <Camera className="size-4" />
              <span className="hidden sm:inline">Shoot one</span>
            </Link>
          </Button>

          {canEdit && (
            <Button asChild size="sm" variant="outline" className="hidden md:inline-flex">
              <Link href="/manage">Manage</Link>
            </Button>
          )}

          <Button asChild size="sm" variant="ghost" className="hidden md:inline-flex">
            <Link href={signedIn ? "/me" : "/login"}>{signedIn ? "Account" : "Sign in"}</Link>
          </Button>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border bg-background px-5 py-3 md:hidden">
          {[...NAV, ...(canEdit ? [{ href: "/manage", label: "Manage" }] : [])].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-medium",
                isActive(item.href) ? "bg-accent text-accent-foreground" : "text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={signedIn ? "/me" : "/login"}
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground"
          >
            {signedIn ? "Your shoots" : "Sign in"}
          </Link>
        </nav>
      )}
    </header>
  );
}
