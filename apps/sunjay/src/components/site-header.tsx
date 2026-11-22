"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { siteConfig } from "@/config/site";
import type { NavItem } from "@elkdonis/services/nav-core";
import { DEFAULT_NAV } from "@/lib/nav-default";

interface SiteHeaderProps {
  signedIn: boolean;
  canEdit: boolean;
  isMember?: boolean;
  /** The menu: the stored `nav:main` row, else DEFAULT_NAV (lib/nav-default.ts). */
  nav?: NavItem[];
}

export function SiteHeader({ signedIn, canEdit, isMember = false, nav = DEFAULT_NAV }: SiteHeaderProps) {
  const homeHref = isMember ? "/hub" : "/center";
  const homeLabel = isMember ? "Hub" : "Center";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const account = signedIn ? { href: "/account", label: "Account" } : { href: "/login", label: "Sign in" };

  // Site style (round 2, 2026-11-14): the header's parts are named for the owner's style editor (lib/site-style-schema.ts).
  const here = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const links = nav.map((link, i) =>
    link.external ? (
      <a key={`${link.href}-${i}`} href={link.href} data-part="links" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
        {link.label}
      </a>
    ) : (
      <Link
        key={`${link.href}-${i}`}
        href={link.href}
        data-part={here(link.href) ? "active" : "links"}
        aria-current={here(link.href) ? "page" : undefined}
        onClick={() => setOpen(false)}
      >
        {link.label}
      </Link>
    )
  );
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
