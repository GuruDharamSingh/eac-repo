"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  offerings?: NavOffering[];
}

const NAV_LINKS = [{ href: "/about", label: "About" }];

export function SiteHeader({
  signedIn,
  canEdit,
  isMember = false,
  offerings = [],
}: SiteHeaderProps) {
  const homeHref = isMember ? "/hub" : "/center";
  const homeLabel = isMember ? "Hub" : "Center";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const offeringsActive = offerings.some(
    (o) => pathname === `/${o.slug}` || pathname.startsWith(`/${o.slug}/`)
  );

  return (
    <header className="bg-header-footer sticky top-0 z-40 border-b-[3px] border-[#d9c08a] shadow-[0_4px_15px_rgba(0,0,0,0.15)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex flex-col leading-tight" onClick={() => setOpen(false)}>
          <span className="font-serif text-lg font-semibold tracking-wide text-[#d9c08a]">
            {siteConfig.orgName}
          </span>
          <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[#f4f1ea]/75">
            {siteConfig.tagline}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#d9c08a]/15",
                  offeringsActive
                    ? "font-medium text-[#d9c08a]"
                    : "text-[#f4f1ea]/80 hover:text-[#d9c08a]"
                )}
              >
                Offerings
                <ChevronDown className="size-3.5" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {offerings.map((offering) => (
                <DropdownMenuItem key={offering.slug} asChild>
                  <Link href={`/${offering.slug}`}>{offering.title}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#d9c08a]/15",
                  active ? "font-medium text-[#d9c08a]" : "text-[#f4f1ea]/80 hover:text-[#d9c08a]"
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
              className="text-[#f4f1ea]/80 hover:bg-[#d9c08a]/15 hover:text-[#d9c08a]"
            >
              <Link href={homeHref}>{homeLabel}</Link>
            </Button>
          )}
          {canEdit && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-[#f4f1ea]/80 hover:bg-[#d9c08a]/15 hover:text-[#d9c08a]"
            >
              <Link href="/manage">Manage</Link>
            </Button>
          )}
          <Button
            asChild
            size="sm"
            className="border border-[#d9c08a]/50 bg-[#d9c08a]/15 text-[#d9c08a] hover:bg-[#d9c08a]/25"
          >
            <Link href={signedIn ? "/account" : "/login"}>
              {signedIn ? "Account" : "Sign in"}
            </Link>
          </Button>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-2 text-[#d9c08a] md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-[#d9c08a]/30 px-5 pb-4 md:hidden">
          <span className="block pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-[#f4f1ea]/75">
            Offerings
          </span>
          {offerings.map((offering) => (
            <Link
              key={offering.slug}
              href={`/${offering.slug}`}
              onClick={() => setOpen(false)}
              className="block py-2 pl-3 text-sm text-[#f4f1ea]/80"
            >
              {offering.title}
            </Link>
          ))}

          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-2.5 text-sm text-[#f4f1ea]/80"
            >
              {link.label}
            </Link>
          ))}
          {signedIn && (
            <Link
              href={homeHref}
              onClick={() => setOpen(false)}
              className="block py-2.5 text-sm text-[#f4f1ea]/80"
            >
              {homeLabel}
            </Link>
          )}
          {canEdit && (
            <Link
              href="/manage"
              onClick={() => setOpen(false)}
              className="block py-2.5 text-sm text-[#f4f1ea]/80"
            >
              Manage
            </Link>
          )}
          <Link
            href={signedIn ? "/account" : "/login"}
            onClick={() => setOpen(false)}
            className="block py-2.5 text-sm font-medium text-[#d9c08a]"
          >
            {signedIn ? "Account" : "Sign in"}
          </Link>
        </nav>
      )}
    </header>
  );
}
