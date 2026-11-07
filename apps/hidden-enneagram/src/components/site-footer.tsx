import Link from "next/link";
import { siteConfig, courseUrl } from "@/config/site";

/** The footer: the site copy's footer lines (org_site_sections.footer, migration 079) with fallbacks. */
export function SiteFooter({ body, note }: { body?: string | null; note?: string | null }) {
  return (
    <footer className="he-footer" data-chrome="footer">
      <div className="he-footer__row">
        <p className="he-footer__title" data-part="title">
          {body?.trim() || siteConfig.orgName}
        </p>
        <nav aria-label="Footer" data-part="links">
          <Link href="/enneagram">The Figure</Link>
          <a href={courseUrl()}>Course</a>
          <Link href="/services">Sessions</Link>
          <Link href="/forum">Forum</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </div>
      <p className="he-footer__note" data-part="small">
        {note?.trim() || "Part of the Elkdonis Arts Collective network."} · © {new Date().getFullYear()} The Hidden Enneagram. All rights reserved.
      </p>
    </footer>
  );
}
