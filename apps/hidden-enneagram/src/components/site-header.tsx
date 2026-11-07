"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { siteConfig } from "@/config/site";
import { SignOutButton } from "@/components/sign-out-button";

export interface HeaderLink {
  href: string;
  label: string;
  /** A members-only section this viewer can open. */
  locked?: boolean;
}

interface SiteHeaderProps {
  /** The menu: The Figure, the org's feeds, Course, Forum, About (built by the layout). */
  links: HeaderLink[];
  signedIn: boolean;
  /** Owner or guide: Manage, Hub, Edit the site. */
  canEdit: boolean;
  /** Has a role in the org (member and up): Hub. */
  isMember: boolean;
  email?: string | null;
}

/**
 * The site bar (katie's header shape in this site's CSS). `data-chrome` and
 * `data-part` let Site style give the header's parts their own look.
 * Replaces SiteNav on every page: it sits in the root layout now.
 */
export function SiteHeader({ links, signedIn, canEdit, isMember, email }: SiteHeaderProps) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  useEffect(() => setOpen(false), [pathname]);

  const items = links.map((link) => {
    const path = link.href.split("#")[0] || "/";
    const current = /^https?:/.test(link.href) ? false : path !== "/" && (pathname === path || pathname.startsWith(`${path}/`));
    return (
      <Link key={link.href} href={link.href} aria-current={current ? "page" : undefined} onClick={close}>
        {link.label}
        {link.locked ? (
          <span className="he-lock" aria-label="members only">
            ◦
          </span>
        ) : null}
      </Link>
    );
  });

  // The network rooms: Hub (members), Center and Channel (anyone signed in; Channel posts for editors).
  const rooms = (
    <>
      {canEdit ? <Link href="/manage" onClick={close}>Manage</Link> : null}
      {canEdit ? <Link href="/studio" onClick={close}>Edit the site</Link> : null}
      {isMember ? <Link href="/hub" onClick={close}>Hub</Link> : null}
      <Link href="/center" onClick={close}>Center</Link>
      {canEdit ? <Link href="/channel" onClick={close}>Channel</Link> : null}
      <Link href="/account" onClick={close}>Account</Link>
    </>
  );

  return (
    <header className="he-header" data-chrome="header">
      <div className="he-header__row">
        <Link href="/" className="he-header__brand" data-part="brand" onClick={close}>
          <span className="he-header__mark" aria-hidden="true">
            ◯
          </span>
          {siteConfig.orgName}
        </Link>
        <nav className="he-header__nav" aria-label="Site" data-part="links">
          {items}
        </nav>
        <div className="he-header__tools">
          {signedIn ? (
            // A native <details>: opens and closes with no script.
            <details className="he-acct" data-part="account">
              <summary aria-label="Account menu">
                <span className="he-acct__dot" aria-hidden="true">
                  {(email ?? "?").charAt(0).toUpperCase()}
                </span>
                <span>{email ? email.split("@")[0] : "Account"}</span>
              </summary>
              <div className="he-acct__panel">
                {rooms}
                <hr />
                <SignOutButton />
              </div>
            </details>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} data-part="account">
              Sign in
            </Link>
          )}
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="he-header__toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open ? (
        <nav className="he-header__sheet" aria-label="Site, menu" data-part="menu">
          {items}
          {signedIn ? (
            <>
              {rooms}
              <SignOutButton />
            </>
          ) : (
            <Link href="/login" onClick={close}>
              Sign in
            </Link>
          )}
        </nav>
      ) : null}
    </header>
  );
}
