import Link from "next/link";
import { siteConfig } from "@/config/site";

interface SiteFooterProps {
  /** org_site_sections['footer'] — editable from /manage/pages. */
  content?: Record<string, string>;
}

export function SiteFooter({ content }: SiteFooterProps) {
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-5 py-10 text-sm">
        <p className="font-serif text-lg">{content?.body ?? siteConfig.orgName}</p>
        <p className="mt-2 text-muted-foreground">
          {content?.note ?? (
            <>
              Guided walks and experiences in {siteConfig.city}. Part of the{" "}
              {process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ? (
                <a href={process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL} className="underline underline-offset-2">Elkdonis Arts Collective</a>
              ) : (
                "Elkdonis Arts Collective"
              )}{" "}
              network.
            </>
          )}
        </p>
        <p className="mt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {siteConfig.orgName} ·{" "}
          <Link href="/tours" className="underline underline-offset-2">Tours</Link> ·{" "}
          <Link href="/login" className="underline underline-offset-2">Guide sign in</Link>
        </p>
      </div>
    </footer>
  );
}
