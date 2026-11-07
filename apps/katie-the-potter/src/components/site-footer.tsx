import Link from "next/link";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  const market = `${siteConfig.marketUrl.replace(/\/+$/, "")}?from=${siteConfig.marketRef}`;
  return (
    <footer className="ktp-footer" data-chrome="footer">
      <div className="ktp-footer__row">
        <p className="ktp-footer__line" data-part="title">{siteConfig.orgName}</p>
        <nav aria-label="Footer" data-part="links">
          <Link href="/#pieces">Pieces</Link>
          <Link href="/about">About</Link>
          <a href={market} target="_blank" rel="noopener noreferrer">
            Collect Art
          </a>
          <a href={`mailto:${siteConfig.ownerEmail}`}>Email</a>
        </nav>
      </div>
      <p className="ktp-footer__note" data-part="small">
        Part of the Elkdonis Arts Collective · © {new Date().getFullYear()} {siteConfig.orgName}
      </p>
    </footer>
  );
}
