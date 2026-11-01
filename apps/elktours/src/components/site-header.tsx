"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { Button } from "@elkdonis/primitives";

export interface NavOffering {
  slug: string;
  title: string;
}

interface SiteHeaderProps {
  signedIn: boolean;
  canEdit: boolean;
  isMember?: boolean;
  /** Public feeds other than tours (the journal), from org_feeds. */
  offerings?: NavOffering[];
}

export function SiteHeader({ signedIn, canEdit, isMember = false, offerings = [] }: SiteHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/tours", label: "Tours" },
    ...offerings.filter((o) => o.slug !== siteConfig.toursFeed).map((o) => ({ href: `/${o.slug}`, label: o.title })),
    { href: "/about", label: "About" },
  ];
  const homeHref = isMember ? "/hub" : "/center";
  const linkClass = (href: string) =>
    cn(
      "px-3 py-2 text-sm transition-colors hover:text-primary",
      pathname === href || pathname.startsWith(`${href}/`) ? "font-medium text-primary" : "text-foreground/80"
    );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex flex-col leading-tight" onClick={() => setOpen(false)}>
          <span className="font-serif text-lg font-semibold tracking-wide">{siteConfig.orgName}</span>
          <span className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">{siteConfig.city}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>{l.label}</Link>
          ))}
          {signedIn && <Link href={homeHref} className={linkClass(homeHref)}>{isMember ? "Hub" : "Center"}</Link>}
          {canEdit && <Link href="/manage/tours" className={linkClass("/manage")}>Manage</Link>}
          <Button asChild size="sm" variant="outline" className="ml-2">
            <Link href={signedIn ? "/account" : "/login"}>{signedIn ? "Account" : "Sign in"}</Link>
          </Button>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="p-2 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-border px-5 pb-4 md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2.5 text-sm">{l.label}</Link>
          ))}
          {signedIn && <Link href={homeHref} onClick={() => setOpen(false)} className="block py-2.5 text-sm">{isMember ? "Hub" : "Center"}</Link>}
          {canEdit && <Link href="/manage/tours" onClick={() => setOpen(false)} className="block py-2.5 text-sm">Manage</Link>}
          <Link href={signedIn ? "/account" : "/login"} onClick={() => setOpen(false)} className="block py-2.5 text-sm font-medium">
            {signedIn ? "Account" : "Sign in"}
          </Link>
        </nav>
      )}
    </header>
  );
}
