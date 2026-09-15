import Link from "next/link";
import { SilexSiteBySlug } from "@elkdonis/silex-render";
import { SiteNav } from "@/components/site-nav";
import { EnneagramDiagram } from "@/components/enneagram/EnneagramDiagram";
import { ORG_SLUG } from "@/lib/session";

// Session-dependent nav + live embeds → always render fresh.
export const dynamic = "force-dynamic";

/**
 * The published Silex site, with the interactive diagram appended below it.
 *
 * The site arrives without its own top bar: `omitSections` drops the
 * template's `eac-enn-nav` at render time, and SiteNav stands in its place.
 * The template's hamburger was decorative — published artifacts are stripped
 * of script, so it could never open — whereas the React bar is a client
 * component and its drawer works. Silex renders the content; React keeps the
 * chrome.
 *
 * Safe to sit next to the Silex markup: that template's stylesheet is entirely
 * class-scoped to `.eac-enn-*` (its only global is a `:root` variable block),
 * and this section uses Tailwind utilities and inline styles, so neither can
 * restyle the other. It is a sibling of the Silex block, never nested inside
 * it, so the sanitised published HTML is untouched.
 */
export default function Home() {
  return (
    <>
      <SiteNav silexPage="index" />
      <SilexSiteBySlug
        slug={ORG_SLUG}
        cssLinks={["/api/silex/templates/enneagram.css"]}
        omitSections={["eac-enn-nav"]}
      />

      <section
        id="enneagram"
        className="border-t border-border px-6 py-20"
        style={{ backgroundColor: "hsl(var(--band))", color: "hsl(var(--band-foreground))" }}
      >
        <div className="mx-auto max-w-md text-center">
          <p className="mb-5 text-xs uppercase tracking-[0.3em]" style={{ color: "hsl(var(--band-primary))" }}>
            The map itself
          </p>
          <h2
            className="mb-4 text-4xl md:text-5xl"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400 }}
          >
            Nine points
          </h2>
          <p
            className="mx-auto mb-12 max-w-lg text-base"
            style={{ color: "rgba(236,231,221,0.55)", lineHeight: 1.8 }}
          >
            Click any point to explore a type. Use the toggles to reveal the
            geometric relationships between them.
          </p>

          <EnneagramDiagram showControls />

          <Link
            href="/triads"
            className="mt-12 inline-block text-xs uppercase tracking-[0.2em] no-underline"
            style={{ color: "hsl(var(--band-primary))" }}
          >
            The centers and triads →
          </Link>
        </div>
      </section>
    </>
  );
}
