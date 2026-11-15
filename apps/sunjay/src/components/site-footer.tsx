import Link from "next/link";
import { siteConfig } from "@/config/site";

interface SiteFooterProps {
  /** org_site_sections['footer'] — editable from /manage/pages. */
  content?: Record<string, string>;
}

export function SiteFooter({ content }: SiteFooterProps) {
  return (
    <footer className="pts-footer" data-chrome="footer" data-edit-section="footer" data-edit-name="Footer">
      <div className="pts-footer__row">
        <p className="pts-footer__line" data-part="title">{content?.body ?? siteConfig.orgName}</p>
        <nav aria-label="Footer">
          <Link href="/about" data-part="links">About</Link>
          <Link href="/publications" data-part="links">Publications</Link>
          <Link href="/community" data-part="links">Community</Link>
          <Link href="/series" data-part="links">Series</Link>
          <Link href="/forum" data-part="links">Forum</Link>
        </nav>
      </div>
      <p className="pts-footer__note" data-part="note">
        {content?.note ?? "Made possible with the support of Elkdonis Arts Collective"} · © {new Date().getFullYear()} {siteConfig.orgName}
      </p>
    </footer>
  );
}
