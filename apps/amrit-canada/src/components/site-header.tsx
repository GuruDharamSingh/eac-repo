"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

interface SiteHeaderProps {
  signedIn: boolean;
  canEdit: boolean;
  isMember?: boolean;
}

const NAV_LINKS = [
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/forum", label: "Forum" },
];

export function SiteHeader({ signedIn, canEdit, isMember = false }: SiteHeaderProps) {
  const homeHref = isMember ? "/hub" : "/center";
  const homeLabel = isMember ? "Hub" : "Center";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
          {NAV_LINKS.map((link) => {
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
              <Link href={homeHref}>{homeLabel}</Link>
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
          {NAV_LINKS.map((link) => (
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
              href={homeHref}
              onClick={() => setOpen(false)}
              className="block py-2.5 text-sm text-[#fdf5e6]/80"
            >
              {homeLabel}
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
