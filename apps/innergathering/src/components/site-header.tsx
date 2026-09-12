"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
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
  /** member or above sees Hub; a follower sees Center. */
  isMember?: boolean;
}

/**
 * The archive topbar, as it was: the navy gradient, the gold rule beneath,
 * the wordmark set in Venture. Links come from the org's feeds (Offerings,
 * Blog), then About, then the member doors.
 */
export function SiteHeader({ feeds, signedIn, canEdit, isMember = false }: SiteHeaderProps) {
  const homeHref = isMember ? "/hub" : "/center";
  const homeLabel = isMember ? "Hub" : "Center";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    ...feeds.map((f) => ({ href: `/${f.slug}`, label: f.name })),
    { href: "/about", label: "About" },
  ];
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const linkClass = (active: boolean) =>
    `ig-nav-link${active ? " is-active" : ""}`;

  return (
    <header className="ig-topbar">
      <div className="ig-topbar-inner">
        <Link href="/" className="ig-wordmark" onClick={() => setOpen(false)}>
          <span className="ig-wordmark-main">{siteConfig.orgName}</span>
          <span className="ig-wordmark-sub">Elkdonis Arts Collective</span>
        </Link>

        <nav className="ig-nav" aria-label="Primary">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(isActive(link.href))}>
              {link.label}
            </Link>
          ))}
          {signedIn && (
            <Link href={homeHref} className={linkClass(isActive(homeHref))}>
              {homeLabel}
            </Link>
          )}
          {canEdit && (
            <Link href="/manage" className={linkClass(isActive("/manage"))}>
              Manage
            </Link>
          )}
          <Link href={signedIn ? "/account" : "/login"} className="ig-nav-link ig-nav-link--door">
            {signedIn ? "Account" : "Web-Portal"}
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ig-nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav className="ig-nav-sheet" aria-label="Primary">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          {signedIn && <Link href={homeHref} onClick={() => setOpen(false)}>{homeLabel}</Link>}
          {canEdit && <Link href="/manage" onClick={() => setOpen(false)}>Manage</Link>}
          <Link href={signedIn ? "/account" : "/login"} onClick={() => setOpen(false)} className="is-door">
            {signedIn ? "Account" : "Web-Portal"}
          </Link>
        </nav>
      )}

    </header>
  );
}
