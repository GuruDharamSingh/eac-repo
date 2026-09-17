"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Menu, X } from "lucide-react";
import { siteConfig } from "@/config/site";

export interface HeaderProps {
  signedIn: boolean;
  canEdit: boolean;
  isMember: boolean;
  /** Public feeds from org_feeds, so a new section of the site is a row. */
  feeds: { slug: string; name: string }[];
}

const FIXED_LINKS = [
  { href: "/books", label: "Books" },
  { href: "/groups", label: "Groups" },
  { href: "/archive", label: "Archive" },
  { href: "/calendar", label: "Calendar" },
  { href: "/about", label: "About" },
];

/**
 * The masthead.
 *
 * Generous at rest — wordmark, nav, and a shelf of three small form boxes —
 * and it dips away as you scroll: the shelf collapses first, then the wordmark
 * shrinks, leaving a slim sticky bar. All of that is CSS keyed off
 * [data-condensed]; this component's whole job is to decide that one boolean.
 *
 * The threshold has 24px of hysteresis (condense at 96, expand at 72). Without
 * it, a page whose height changes as the header collapses can land exactly on
 * the boundary and oscillate — the header flickers open and shut while the
 * page sits still, which is a genuinely unpleasant bug to watch.
 */
export function SiteHeader({ signedIn, canEdit, isMember, feeds }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [condensed, setCondensed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const condensedRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const next = condensedRef.current ? y > 72 : y > 96;
      if (next !== condensedRef.current) {
        condensedRef.current = next;
        setCondensed(next);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the drawer on navigation — otherwise it stays open over the new page.
  useEffect(() => setMenuOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const homeHref = isMember ? "/hub" : "/center";
  const homeLabel = isMember ? "Hub" : "Center";

  const links = [
    ...FIXED_LINKS,
    // Feed rows that aren't already one of the fixed links.
    ...feeds
      .filter((f) => !FIXED_LINKS.some((l) => l.href === `/${f.slug}`))
      .map((f) => ({ href: `/${f.slug}`, label: f.name })),
  ];

  const go = (e: FormEvent<HTMLFormElement>, build: (data: FormData) => string) => {
    e.preventDefault();
    const href = build(new FormData(e.currentTarget));
    if (href) router.push(href);
  };

  return (
    <header className="masthead" data-condensed={condensed}>
      <div className="column">
        <div className="masthead__top">
          <Link href="/" className="wordmark">
            <span className="wordmark__name">{siteConfig.orgName}</span>
            <span className="wordmark__tag">{siteConfig.tagline}</span>
          </Link>

          <nav className="masthead__nav" aria-label="Primary">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="navlink" data-active={isActive(l.href)}>
                {l.label}
              </Link>
            ))}
            {signedIn && (
              <Link href={homeHref} className="navlink" data-active={isActive(homeHref)}>
                {homeLabel}
              </Link>
            )}
            {canEdit && (
              <Link href="/manage" className="navlink" data-active={isActive("/manage")}>
                Manage
              </Link>
            )}
            <Link href={signedIn ? "/account" : "/login"} className="navlink navlink--cta">
              {signedIn ? "Account" : "Sign in"}
            </Link>
          </nav>

          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={14} aria-hidden /> : <Menu size={14} aria-hidden />}
            Menu
          </button>
        </div>

        {/* The small form boxes. Each one navigates to a real page rather than
            posting anywhere — a header is a signpost, not a form handler. */}
        <div className="masthead__shelf">
          <form className="formbox" onSubmit={(e) => go(e, (d) => {
            const q = String(d.get("q") ?? "").trim();
            return q ? `/archive?q=${encodeURIComponent(q)}` : "/archive";
          })}>
            <label className="formbox__label" htmlFor="hdr-q">Search the archive</label>
            <div className="formbox__row">
              <input id="hdr-q" name="q" type="search" placeholder="a passage, a night" />
              <button type="submit">Go</button>
            </div>
          </form>

          <form className="formbox" onSubmit={(e) => go(e, (d) => {
            const p = String(d.get("page") ?? "").trim();
            return /^\d+$/.test(p) ? `/books?page=${p}` : "/books";
          })}>
            <label className="formbox__label" htmlFor="hdr-page">Turn to a page</label>
            <div className="formbox__row">
              <input id="hdr-page" name="page" type="number" min={1} placeholder="e.g. 47" />
              <button type="submit">Open</button>
            </div>
            <span className="formbox__note">Opens the reading page at that leaf.</span>
          </form>

          <form className="formbox" onSubmit={(e) => go(e, (d) => {
            const t = String(d.get("title") ?? "").trim();
            return t ? `/suggest?title=${encodeURIComponent(t)}` : "/suggest";
          })}>
            <label className="formbox__label" htmlFor="hdr-suggest">Suggest a book</label>
            <div className="formbox__row">
              <input id="hdr-suggest" name="title" type="text" placeholder="title" />
              <button type="submit">Send</button>
            </div>
          </form>
        </div>

        {menuOpen && (
          <nav className="masthead__drawer" aria-label="Primary, compact">
            {links.map((l) => (
              <Link key={l.href} href={l.href}>{l.label}</Link>
            ))}
            {signedIn && <Link href={homeHref}>{homeLabel}</Link>}
            {canEdit && <Link href="/manage">Manage</Link>}
            <Link href={signedIn ? "/account" : "/login"}>{signedIn ? "Account" : "Sign in"}</Link>
          </nav>
        )}
      </div>
    </header>
  );
}
