"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

interface NavFeed {
  slug: string;
  name: string;
}

interface SiteHeaderProps {
  /** From org_feeds — nav is data, so a new section needs no code change. */
  feeds: NavFeed[];
  signedIn: boolean;
  canEdit: boolean;
}

export function SiteHeader({ feeds, signedIn, canEdit }: SiteHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    ...feeds.map((f) => ({ href: `/${f.slug}`, label: f.name })),
    { href: "/about", label: "About" },
    { href: "/resources", label: "Resources" },
  ];

  // Charcoal gradient with a saffron rule underneath — the original chrome.
  return (
    <header className="bg-header-footer sticky top-0 z-40 border-b-[3px] border-[#f4c430] shadow-[0_4px_15px_rgba(0,0,0,0.15)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex flex-col leading-tight" onClick={() => setOpen(false)}>
          <span className="font-serif text-lg font-semibold tracking-wide text-[#f4c430]">
            {siteConfig.orgName}
          </span>
          <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[#fdf5e6]/60">
            {siteConfig.city}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#f4c430]/15",
                  active ? "font-medium text-[#f4c430]" : "text-[#fdf5e6]/80 hover:text-[#f4c430]"
                )}
              >
                {link.label}
              </Link>
            );
          })}
          {signedIn && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-[#fdf5e6]/80 hover:bg-[#f4c430]/15 hover:text-[#f4c430]"
            >
              <Link href="/hub">Hub</Link>
            </Button>
          )}
          {canEdit && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-[#fdf5e6]/80 hover:bg-[#f4c430]/15 hover:text-[#f4c430]"
            >
              <Link href="/manage">Manage</Link>
            </Button>
          )}
          <Button
            asChild
            size="sm"
            className="border border-[#f4c430]/50 bg-[#f4c430]/15 text-[#f4c430] hover:bg-[#f4c430]/25"
          >
            <Link href={signedIn ? "/account" : "/login"}>
              {signedIn ? "Account" : "Sign in"}
            </Link>
          </Button>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-2 text-[#f4c430] md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-[#f4c430]/30 px-5 pb-4 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-2.5 text-sm text-[#fdf5e6]/80"
            >
              {link.label}
            </Link>
          ))}
          {signedIn && (
            <Link
              href="/hub"
              onClick={() => setOpen(false)}
              className="block py-2.5 text-sm text-[#fdf5e6]/80"
            >
              Hub
            </Link>
          )}
          {canEdit && (
            <Link
              href="/manage"
              onClick={() => setOpen(false)}
              className="block py-2.5 text-sm text-[#fdf5e6]/80"
            >
              Manage
            </Link>
          )}
          <Link
            href={signedIn ? "/account" : "/login"}
            onClick={() => setOpen(false)}
            className="block py-2.5 text-sm font-medium text-[#f4c430]"
          >
            {signedIn ? "Account" : "Sign in"}
          </Link>
        </nav>
      )}
    </header>
  );
}
