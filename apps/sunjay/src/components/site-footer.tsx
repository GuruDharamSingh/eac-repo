import Link from "next/link";
import { siteConfig } from "@/config/site";

interface SiteFooterProps {
  /** org_site_sections['footer'] — editable from /manage/pages. */
  content?: Record<string, string>;
}

export function SiteFooter({ content }: SiteFooterProps) {
  return (
    <footer className="pts-footer" data-edit-section="footer" data-edit-name="Footer">
      <div className="pts-footer__row">
        <p className="pts-footer__line">{content?.body ?? siteConfig.orgName}</p>
        <nav aria-label="Footer">
          <Link href="/about">About</Link>
          <Link href="/publications">Publications</Link>
          <Link href="/community">Community</Link>
          <Link href="/series">Series</Link>
          <Link href="/forum">Forum</Link>
        </nav>
      </div>
      <p className="pts-footer__note">
        {content?.note ?? "Made possible with the support of Elkdonis Arts Collective"} · © {new Date().getFullYear()} {siteConfig.orgName}
      </p>
    </footer>
  );
}
