import Link from "next/link";
import { siteConfig } from "@/config/site";

interface SiteFooterProps {
  /** org_site_sections['footer'] — editable from /manage/pages. */
  content?: Record<string, string>;
}

/**
 * Charcoal gradient with the saffron rule on top, matching the header — the
 * original site's chrome. The default line ("Crown yourself in the early
 * hours of the morning") is the site's own, not filler.
 */
export function SiteFooter({ content }: SiteFooterProps) {
  return (
    <footer className="bg-header-footer mt-16 border-t-[3px] border-[#d9c08a] shadow-[0_-4px_15px_rgba(0,0,0,0.15)]">
      <div className="mx-auto max-w-6xl px-5 py-10 text-center">
        <p className="font-serif text-lg tracking-wide text-[#d9c08a]">
          {content?.body ?? "Crown yourself in the early hours of the morning 🙏"}
        </p>
        <p className="mt-3 text-sm text-[#f4f1ea]/80">
          {content?.note ?? (
            <>
              {siteConfig.orgName} · part of the{" "}
              {process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ? (
                <a
                  href={process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL}
                  className="underline underline-offset-2 hover:text-[#d9c08a]"
                >
                  Elkdonis Arts Collective
                </a>
              ) : (
                "Elkdonis Arts Collective"
              )}{" "}
              network.
            </>
          )}
        </p>
        <p className="mt-6 text-xs text-[#f4f1ea]/75">
          © {new Date().getFullYear()} {siteConfig.orgName} ·{" "}
          <Link href="/forum" className="underline underline-offset-2 hover:text-[#d9c08a]">
            Forum
          </Link>{" "}
          ·{" "}
          <Link href="/login" className="underline underline-offset-2 hover:text-[#d9c08a]">
            Member sign in
          </Link>
        </p>
      </div>
    </footer>
  );
}
