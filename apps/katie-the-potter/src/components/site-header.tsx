"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { siteConfig } from "@/config/site";
import { SignOutButton } from "@/components/sign-out-button";

interface SiteHeaderProps {
  signedIn: boolean;
  canEdit: boolean;
  /** The signed-in person's email, for the account menu. */
  email?: string | null;
  /** Lines in the visitor's cart. */
  cartCount?: number;
}

/** Sunjay's header shape (brand, nav, tools, a sheet on phones) in this site's own CSS. */
const NAV_LINKS = [
  { href: "/#pieces", label: "Pieces" },
  { href: "/about", label: "About" },
];

export function SiteHeader({ signedIn, canEdit, email, cartCount = 0 }: SiteHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const links = NAV_LINKS.map((link) => {
    const path = link.href.split("#")[0] || "/";
    const current = path !== "/" && (pathname === path || pathname.startsWith(`${path}/`));
    return (
      <Link key={link.href} href={link.href} aria-current={current ? "page" : undefined} onClick={close}>
        {link.label}
      </Link>
    );
  });

  const cart = (
    <Link
      className="ktp-header__cta"
      data-part="cart"
      href="/cart"
      aria-label={cartCount > 0 ? `Cart, ${cartCount} ${cartCount === 1 ? "piece" : "pieces"}` : "Cart, empty"}
      onClick={close}
    >
      Cart
      {/* The count is for a cart with something in it; "0" says nothing. */}
      {cartCount > 0 ? (
        <span className="ktp-header__count" aria-hidden="true">
          {cartCount}
        </span>
      ) : null}
    </Link>
  );

  return (
    <header className="ktp-header" data-chrome="header">
      <div className="ktp-header__row">
        <Link href="/" className="ktp-header__brand" data-part="brand" onClick={close}>
          {siteConfig.orgName}
        </Link>
        <nav className="ktp-header__nav" aria-label="Site" data-part="links">
          {links}
        </nav>
        <div className="ktp-header__tools">
          {signedIn ? (
            // A native <details>: opens and closes with no script, closes on Escape.
            <details className="ktp-acct" data-part="account">
              <summary aria-label="Account menu">
                <span className="ktp-acct__dot" aria-hidden="true">
                  {(email ?? "?").charAt(0).toUpperCase()}
                </span>
                <span className="ktp-acct__name">{email ? email.split("@")[0] : "Account"}</span>
              </summary>
              <div className="ktp-acct__panel">
                {canEdit ? <Link href="/manage">Manage</Link> : null}
                {canEdit ? <Link href="/studio">Edit the site</Link> : null}
                <Link href="/account">Account</Link>
                <SignOutButton className="ktp-acct__out" />
              </div>
            </details>
          ) : (
            <Link href="/login" data-part="account">Sign in</Link>
          )}
          {cart}
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="ktp-header__toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <nav className="ktp-header__sheet" aria-label="Site, menu" data-part="menu">
          {links}
          {canEdit ? (
            <Link href="/manage" onClick={close}>
              Manage
            </Link>
          ) : null}
          {signedIn ? (
            <Link href="/account" onClick={close}>
              Account
            </Link>
          ) : (
            <Link href="/login" onClick={close}>
              Sign in
            </Link>
          )}
          {cart}
          {signedIn ? <SignOutButton className="ktp-acct__out" /> : null}
        </nav>
      )}
    </header>
  );
}
