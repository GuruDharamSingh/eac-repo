import Link from "next/link";
import { siteConfig } from "@/config/site";

/**
 * Just her name, bottom-left of the content column — that's what her real
 * footer was, plus one link.
 *
 * The Credits link is a LICENCE CONDITION, not a flourish: Preline UI's Fair
 * Use rider permits its blocks in a page builder only with attribution naming
 * Preline UI and linking its repository. Removing this link without removing
 * the Preline-derived block would put the site out of licence.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        {siteConfig.orgName}
        <Link href="/credits" style={{ marginInlineStart: "1rem", fontSize: ".8rem" }}>
          Credits
        </Link>
      </p>
    </footer>
  );
}
