import type { ReactNode } from "react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getServerSession } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";
import { defaultSiteContent } from "@/lib/default-content";
import "@elkdonis/series-site/site.css";
import { SocialRow } from "./social-row";
export { Icon } from "@elkdonis/series-site/components/icons";

/**
 * Chrome for the public IFAC pages (landing, series, about, publications):
 * a thin sticky header, an optional letterboxed banner, and the footer.
 * Scoped under `.ifs` (site.css); the hub, forum, manage and person pages
 * keep the older `SiteHeader` in site-chrome.tsx.
 */

const FONTS =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Source+Sans+3:wght@400;600;700&display=swap";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="ifs">
      {/* A link rather than next/font: Turbopack's font fetch fails production
          builds on this host (see arts-collective /studio). */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={FONTS} />
      {children}
    </div>
  );
}

export type NavKey = "home" | "about" | "publications" | "forum" | "series";

/**
 * The header mark: the IFAC lettering if the owner has dropped it into
 * apps/ifac/public as ifac-lettering.(svg|png|webp), else the seal.
 */
function letteringSrc(): string | null {
  for (const ext of ["svg", "png", "webp"]) {
    if (existsSync(join(process.cwd(), "public", `ifac-lettering.${ext}`))) return `/ifac-lettering.${ext}`;
  }
  return null;
}

/**
 * The nav names the series by its role, not its title (2026-10-10): a long
 * title crowded the bar. Since 2026-10-18 the item is "Series" and goes to
 * /series, the page of every series; `seriesHref` only decides whether the
 * item shows (callers pass it when the org has a series). `seriesLabel` is
 * accepted but not shown.
 */
const SERIES_NAV_LABEL = "Series";
const SERIES_INDEX_HREF = "/series";

export async function PublicHeader({ active, seriesHref }: { active?: NavKey; seriesHref?: string | null; seriesLabel?: string | null }) {
  const session = await getServerSession();
  const signedIn = Boolean(session.user);
  const lettering = letteringSrc();
  const items: Array<{ key: NavKey; href: string; label: string }> = [
    { key: "home", href: "/", label: "Home" },
    ...(seriesHref ? [{ key: "series" as const, href: SERIES_INDEX_HREF, label: SERIES_NAV_LABEL }] : []),
    { key: "about", href: "/about", label: "About" },
    { key: "publications", href: "/publications", label: "Publications" },
    { key: "forum", href: "/forum", label: "Forum" },
  ];
  const cta = signedIn ? { href: "/hub", label: "Hub" } : { href: "/login?mode=signup&next=/hub", label: "Join / Sign in" };
  return (
    <header className="ifs-header">
      <div className="ifs-wrap">
        <a className="ifs-brand" href="/" aria-label={siteConfig.orgName}>
          {lettering ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="ifs-brand__img" src={lettering} alt="IFAC" />
          ) : (
            <span className="ifs-seal">IFAC</span>
          )}
        </a>
        <nav className="ifs-nav" aria-label="Site">
          {items.map((it) => (
            <a key={it.key} href={it.href} aria-current={active === it.key ? "page" : undefined}>
              {it.label}
            </a>
          ))}
          <a className="ifs-nav__cta" href={cta.href}>{cta.label}</a>
          <details className="ifs-nav__menu">
            <summary aria-label="Menu">
              <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </summary>
            <div className="ifs-nav__sheet">
              {items.map((it) => (
                <a key={it.key} href={it.href}>{it.label}</a>
              ))}
              {/* On phones the social icons live here (developer, 2026-10-10). */}
              <SocialRow />
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}

export function PublicBanner({ imageUrl, alt, letteringUrl }: { imageUrl: string; alt?: string; letteringUrl?: string | null }) {
  return (
    <div className={`ifs-banner${letteringUrl ? "" : " ifs-banner--full"}`}>
      {/* The collage, blurred, as the ground; the lettering (or the whole
          logo image) sits on top. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={`ifs-banner__blur${letteringUrl ? " ifs-banner__blur--deep" : ""}`} src={imageUrl} alt="" aria-hidden="true" />
      {letteringUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ifs-banner__lettering" src={letteringUrl} alt={alt ?? siteConfig.orgName} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ifs-banner__logo" src={imageUrl} alt={alt ?? siteConfig.orgName} />
      )}
    </div>
  );
}

export function PublicFooter({ seriesHref }: { seriesHref?: string | null; seriesLabel?: string | null } = {}) {
  const content = defaultSiteContent.footer;
  // The social and email links are the icon row on its own line under the
  // nav (round 3, developer, 2026-10-10), not text links in it.
  return (
    <footer className="ifs-footer">
      <div className="ifs-wrap">
        <div className="ifs-footer__row">
          <a href="/">Home</a>
          {seriesHref && <a href={SERIES_INDEX_HREF}>{SERIES_NAV_LABEL}</a>}
          <a href="/about">About</a>
          <a href="/publications">Publications</a>
          <a href="/forum">Forum</a>
        </div>
        <SocialRow variant="footer" />
        <div>© {new Date().getFullYear()} IFAC International Fine Art Collectors · {content.email}</div>
        <div className="ifs-footer__host">Hosted on the Elkdonis Arts Collective network</div>
      </div>
    </footer>
  );
}
