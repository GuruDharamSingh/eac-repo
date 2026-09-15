"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";

/**
 * Her real site's nav, in her real order (sampled from the live screenshots
 * and the scraped page text — every one of these was an actual menu item on
 * danamccool.com). Two of them point back into this network rather than to a
 * local route: ELKDONIS ARTS and IFAC / ART COLLECTORS.
 */
const NAV_LINKS: Array<{ label: string; href: string; external?: boolean }> = [
  { label: "Current & Upcoming", href: "/current" },
  { label: "CV", href: "/cv" },
  { label: "Elkdonis Arts", href: siteConfig.elkdonisArtsUrl, external: true },
  { label: "Manifestos", href: "/manifestos" },
  { label: "Collections", href: "/collections" },
  { label: "Mixed Media", href: "/mixed-media" },
  { label: "Past Exhibitions", href: "/exhibitions" },
  { label: "Vimeo", href: "/vimeo" },
  { label: "Art Archive", href: "/art-archive" },
  { label: "Biography", href: "/biography" },
  { label: "Contact", href: "/contact" },
  { label: "IFAC / Art Collectors", href: `${siteConfig.ifacUrl}${siteConfig.ifacProfilePath}`, external: true },
  { label: "Partial Gallery", href: "/gallery" },
  { label: "Commission Inquiries", href: "/commissions" },
];

/**
 * Fixed left sidebar: logo mark, then the vertical uppercase nav, then a
 * social row — the shape of her real site (see danascreenshots/*.png). The
 * technical wiring (usePathname active state, editor-only "Manage" link)
 * follows amrit-canada's SiteHeader; the visuals are her own, not theirs.
 */
export function SiteHeader({ canEdit }: { canEdit: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="site-sidebar">
      <Link href="/" className="brand-mark" aria-label="Dana McCool home">
        <img src="/images/logo-uranus.png" alt="" width={150} height={136} />
      </Link>

      <nav className="side-nav" aria-label="Primary">
        {NAV_LINKS.map((link) => {
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
          <Link href="/gallery" className="side-nav-link side-nav-link--manage">
            Manage
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
    </aside>
  );
}
