import Link from "next/link";
import { siteConfig } from "@/config/site";

interface SiteFooterProps {
  /** org_site_sections['footer'] — editable from /manage/pages. */
  content?: Record<string, string>;
}

/**
 * The map-data credit line is not decoration: OpenStreetMap's ODbL and the
 * Open Government Licence – Toronto both require attribution wherever their
 * data is shown. It lives in org_site_sections so it can be corrected without
 * a deploy, with the legally-required text as the fallback.
 */
export function SiteFooter({ content }: SiteFooterProps) {
  return (
    <footer className="mt-20 border-t border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-display text-lg font-semibold">
              Pigeon<span className="text-primary">shoot</span>
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {content?.body ?? siteConfig.tagline}
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/cards" className="text-muted-foreground hover:text-foreground">
              Cards
            </Link>
            <Link href="/species" className="text-muted-foreground hover:text-foreground">
              Species
            </Link>
            <Link href="/rubric" className="text-muted-foreground hover:text-foreground">
              What makes a good card
            </Link>
            <Link href="/about" className="text-muted-foreground hover:text-foreground">
              About
            </Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-muted-foreground/80">
          {content?.credit ??
            "Maps © OpenStreetMap contributors. Neighbourhood boundaries: City of Toronto Open Data, under the Open Government Licence – Toronto."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          © {new Date().getFullYear()} {siteConfig.orgName} · part of the Elkdonis Arts Collective
          network.
        </p>
      </div>
    </footer>
  );
}
