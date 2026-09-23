"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";
import type { NavItem } from "@/lib/navigation";

/**
 * The nav is DATA now, passed in from the layout.
 *
 * It used to be the array that lived here — fine for a site somebody writes in
 * a code editor, useless for one somebody builds in Puck: you publish a page
 * and nothing links to it, with no way to say so without opening the
 * repository. Her original order is still the default (see
 * lib/navigation.ts); this component just draws whatever it is given.
 */

/**
 * Fixed left sidebar: logo mark, then the vertical uppercase nav, then a
 * social row — the shape of her real site (see danascreenshots/*.png). The
 * technical wiring (usePathname active state, editor-only "Manage" link)
 * follows amrit-canada's SiteHeader; the visuals are her own, not theirs.
 */
export function SiteHeader({ canEdit, nav }: { canEdit: boolean; nav: NavItem[] }) {
  const pathname = usePathname();
  // Phones only: the nav slides out from the left. On a desktop the drawer is
  // just the rest of the sidebar and this flag changes nothing (site.css).
  const [open, setOpen] = useState(false);

  // Following a link closes it — the page changes underneath, and a drawer
  // still covering the new page reads as the link having done nothing.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <aside className="site-sidebar" data-open={open ? "true" : "false"}>
      <Link href="/" className="brand-mark" aria-label="Dana McCool home">
        <img src="/images/logo-uranus.png" alt="" width={150} height={136} />
      </Link>

      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="side-drawer"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="nav-toggle-bars" aria-hidden="true" />
        {open ? "Close" : "Menu"}
      </button>
      {open ? <button type="button" className="nav-scrim" aria-label="Close the menu" onClick={() => setOpen(false)} /> : null}

      <div className="side-drawer" id="side-drawer">
      <nav className="side-nav" aria-label="Primary">
        {nav.map((link) => {
          const active = !link.external && (pathname === link.href || pathname.startsWith(`${link.href}/`));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={active ? "side-nav-link is-active" : "side-nav-link"}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noreferrer" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
        {canEdit && (
          <>
            <Link href="/hub" className="side-nav-link side-nav-link--manage">
              Hub
            </Link>
            {/* The editor had no way in until this link existed. The routes are
                /studio/<slug> and /p/<slug>, and a page builder nobody can find
                is a page builder nobody uses. */}
            <Link href="/studio" className="side-nav-link side-nav-link--manage">
              Pages
            </Link>
            <Link href="/manage/artworks" className="side-nav-link side-nav-link--manage">
              Artwork listings
            </Link>
            <Link href="/manage/messages" className="side-nav-link side-nav-link--manage">
              Messages
            </Link>
            <Link href="/studio/theme" className="side-nav-link side-nav-link--manage">
              Theme
            </Link>
            <Link href="/studio/navigation" className="side-nav-link side-nav-link--manage">
              Navigation
            </Link>
          </>
        )}
        {!canEdit && (
          // The login route has existed since this site was built and nothing
          // anywhere linked to it, so signing in meant knowing to type /login.
          <Link href="/login" className="side-nav-link side-nav-link--manage">
            Sign in
          </Link>
        )}
      </nav>

      <ul className="social-row" aria-label="Contact">
        <li>
          <a href={`mailto:${siteConfig.ownerEmail}`} aria-label="Email Dana McCool" title="Email">
            ✉
          </a>
        </li>
      </ul>
      </div>
    </aside>
  );
}
