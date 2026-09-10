import { getServerSession } from "@elkdonis/auth-server";
import { socialIcon } from "@/lib/social-icons";
import { siteConfig } from "@/config/site";
import type { IfacSiteContent } from "@/lib/types";

const headerSocialLinks = [
  { label: "Facebook", href: "https://www.facebook.com/groups/ifacgroup/" },
  { label: "X", href: "https://twitter.com/IFAC_Group" },
  { label: "Threads", href: "https://threads.net/ifac_group/" },
  { label: "YouTube", href: "https://www.youtube.com/@ifacgroup/playlists" },
  { label: "Instagram", href: "https://www.instagram.com/ifac_group" },
  { label: "Bluesky", href: "https://bsky.app/profile/ifacgroup.bsky.social" },
  { label: "Email", href: "mailto:info@ifacgroup.com" },
];

export interface SiteHeaderBanner {
  imageUrl: string;
  alt?: string;
  /** Extra class on the banner section, e.g. "hub-hero". */
  className?: string;
}

/**
 * `banner` moves the page's hero image up into the header so the nav can sit
 * directly beneath it. Pages that pass nothing (about, artists, dealers,
 * gallery) render exactly as before, with the nav under the brand — adding a
 * banner to them would be a visual change nobody asked for.
 */
export async function SiteHeader({ banner }: { banner?: SiteHeaderBanner } = {}) {
  const session = await getServerSession();

  return (
    <header className="site-header">
      <div className="header-main">
        <a className="brand-mark" href="/" aria-label="IFAC home">
          <span className="brand-seal">IFAC</span>
          {/* Domain line dropped: it cost the width that keeps the social
              marks on the same line as the brand, and the address is already
              in the URL bar and the footer. With it gone, shortName here just
              repeated the seal, so the copy expands the acronym instead —
              and yields space first when the row gets tight. */}
          <span className="brand-copy">
            <strong>{siteConfig.orgName}</strong>
          </span>
        </a>

        {/* Beside the brand, marks only. No "Social:" caption — up here the
            icons are recognisable on their own, and the word was competing
            with the brand for the same line. The list still carries an
            accessible name so it is announced as a group. */}
        <ul className="social-row-links header-socials" aria-label="IFAC social links">
          {headerSocialLinks.map((link) => {
            const icon = socialIcon(link.href);
            const external = link.href.startsWith("http");
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  // Icon-only, so the label has to survive as the accessible
                  // name, and as a tooltip for sighted users.
                  aria-label={link.label}
                  title={link.label}
                >
                  {icon ? (
                    <span
                      className="social-icon"
                      style={{ ["--social-icon" as string]: `url(/social/${icon}.svg)` }}
                      aria-hidden
                    />
                  ) : (
                    <span className="social-row-fallback">{link.label}</span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      {banner && (
        <section
          className={`hero image-only${banner.className ? ` ${banner.className}` : ""}`}
          aria-label="IFAC banner"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner.imageUrl} alt={banner.alt ?? "IFAC banner"} />
        </section>
      )}

      {/* Its own row under the banner, kept to a single line. Blog and Social
          are reachable from the page itself and were only lengthening this. */}
      <nav className="main-nav" aria-label="Primary navigation">
        <a href="/">Home</a>
        <a href="/about">About</a>
        <a href="/#artists">Artists</a>
        <a href="/#dealers">Dealers</a>
        <a href="/#videos">Videos</a>
        <a href="/forum">Forum</a>
        <a href="/#signup">Sign up</a>
        {session.user ? <a href="/hub">Hub</a> : <a href="/login">Sign in</a>}
      </nav>
    </header>
  );
}

export function SiteFooter({ content }: { content: IfacSiteContent["footer"] }) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <p className="kicker">{siteConfig.shortName}</p>
          <p>Copyright © 2026 IFAC International Fine Art Collectors All Rights Reserved</p>
          <p className="small-note">Contact: {content.email}</p>
        </div>
        <div className="footer-links">
          {content.links.map((link) => (
            <a key={`${link.label}-${link.href}`} href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel={link.href.startsWith("http") ? "noreferrer" : undefined}>
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
