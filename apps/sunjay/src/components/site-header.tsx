"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { siteConfig } from "@/config/site";

interface SiteHeaderProps {
  signedIn: boolean;
  canEdit: boolean;
  isMember?: boolean;
}

/** Three pages in the nav (developer, 2026-11-02); the series is reached from the landing and Community. */
const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/publications", label: "Publications" },
  { href: "/community", label: "Community" },
];

export function SiteHeader({ signedIn, canEdit, isMember = false }: SiteHeaderProps) {
  const homeHref = isMember ? "/hub" : "/center";
  const homeLabel = isMember ? "Hub" : "Center";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const account = signedIn ? { href: "/account", label: "Account" } : { href: "/login", label: "Sign in" };

  // Site style (round 2, 2026-11-14): the header's parts are named for the owner's style editor (lib/site-style-schema.ts).
  const here = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const links = NAV_LINKS.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      data-part={here(link.href) ? "active" : "links"}
      aria-current={here(link.href) ? "page" : undefined}
      onClick={() => setOpen(false)}
    >
      {link.label}
    </Link>
  ));
  const tools = (
    <>
      {signedIn && <Link href={homeHref} data-part="tools" onClick={() => setOpen(false)}>{homeLabel}</Link>}
      {canEdit && <Link href="/manage" data-part="tools" onClick={() => setOpen(false)}>Manage</Link>}
      {canEdit && <Link href="/channel" data-part="tools" onClick={() => setOpen(false)}>Channel</Link>}
      <Link className="pts-header__cta" data-part="account" href={account.href} onClick={() => setOpen(false)}>{account.label}</Link>
    </>
  );

  return (
    <header className="pts-header" data-chrome="header">
      <div className="pts-header__row">
        <Link href="/" className="pts-header__brand" data-part="brand" onClick={() => setOpen(false)}>
          {siteConfig.orgName}
        </Link>
        <nav className="pts-header__nav" aria-label="Site">{links}</nav>
        <div className="pts-header__tools">{tools}</div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="pts-header__toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav className="pts-header__sheet" data-part="menu" aria-label="Site, menu">
          {links}
          {tools}
        </nav>
      )}
    </header>
  );
}
