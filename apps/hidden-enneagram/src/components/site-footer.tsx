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
          <Link href="/enneagram">The Enneagram</Link>
          <Link href="/readings">Readings</Link>
          <Link href="/writing">Writing</Link>
          <Link href="/forum">Forum</Link>
          <Link href="/about">About</Link>
          <Link href="/#contact">Contact</Link>
        </nav>
      </div>
      {/* Round 3: the free course, de-emphasised: one quiet line here and one on /enneagram. */}
      <p className="he-footer__note he-footer__course" data-part="small">
        <a href={courseUrl()}>A free course on the enneagram</a>, on Sophia.
      </p>
      <p className="he-footer__note" data-part="small">
        {note?.trim() || "Part of the Elkdonis Arts Collective network."} · © {new Date().getFullYear()} The Hidden Enneagram. All rights reserved.
      </p>
    </footer>
  );
}
