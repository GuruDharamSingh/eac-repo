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

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="social-bar" aria-label="IFAC social links">
        <img src="https://ifacgroup.com/images/socialicons.png" alt="IFAC social media" />
        <div className="social-bar-links">
          {headerSocialLinks.map((link) => (
            <a key={link.href} href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel={link.href.startsWith("http") ? "noreferrer" : undefined}>
              {link.label}
            </a>
          ))}
        </div>
      </div>
      <div className="header-main">
        <a className="brand-mark" href="/" aria-label="IFAC home">
          <span className="brand-seal">IFAC</span>
          <span className="brand-copy">
            <strong>{siteConfig.shortName}</strong>
            <span>{siteConfig.domain}</span>
          </span>
        </a>
        <nav className="main-nav" aria-label="Primary navigation">
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/#artists">Artists</a>
          <a href="/#dealers">Dealers</a>
          <a href="/#blog">Blog</a>
          <a href="/#videos">Videos</a>
          <a href="/#social">Social</a>
          <a href="/#events">RSVP</a>
          <a href="/#signup">Sign up</a>
          <a href="/admin">Admin</a>
        </nav>
      </div>
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
