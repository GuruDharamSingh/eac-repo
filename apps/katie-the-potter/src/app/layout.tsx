import { AnalyticsBeacon } from "@elkdonis/analytics/beacon";
// The ROOT layout imports every stylesheet, deliberately: Puck's canvas is an
// iframe whose CopyHostStyles mirrors the parent document's <style>/<link>
// tags, and Next scopes a route's CSS import to that route. globals.css pulls
// in blocks.css, the picker's sheet and the site shell; the two site blocks
// import their own sheets, which reach here through the catalogue import in
// the studio route.
import "./globals.css";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fontVariables } from "@/lib/fonts";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { getCartCount } from "@/lib/shop";
import { siteStyleCss, siteStyleFontsHref } from "@elkdonis/direct-edit/site";
import { loadSiteStyle } from "@/lib/site-style";
import { SITE_STYLE } from "@/lib/site-style-schema";
import { lookOf, SITE_LOOK_VAR } from "@/blocks/looks";
import { SiteStyleButton } from "@/components/site-style/SiteStyleButton";

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.orgName} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.orgName}`,
  },
  description: `${siteConfig.orgName}. ${siteConfig.tagline}. Pieces for sale through Collect Art.`,
};

/** Every page reads the session (to offer editing to the owner), so nothing is prerendered. */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [viewer, cartCount, siteStyle] = await Promise.all([getViewer().catch(() => null), getCartCount(), loadSiteStyle().catch(() => null)]);
  // The site style (elktours' pattern): stored values over SITE_STYLE's
  // defaults, as one <style>. Nothing stored = nothing emitted. A <style> (not
  // inline attributes) so Puck's canvas mirrors it; `data-site-style` lets the
  // editor switch it off while it previews a draft.
  const styleCss = siteStyleCss(siteStyle, SITE_STYLE);
  const styleFonts = siteStyleFontsHref(siteStyle, SITE_STYLE);
  // The shop-wide card look (looks.ts). "house" is the design itself: no attribute.
  const siteLook = lookOf(siteStyle?.theme?.[SITE_LOOK_VAR]);
  return (
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <body suppressHydrationWarning className="flex min-h-screen flex-col" data-site-look={siteLook && siteLook !== "house" ? siteLook : undefined}>
        {/* In <body>, as elktours: a plain <style> keeps its data attribute (React
            would hoist and strip one with href/precedence), and the editor finds
            it by that attribute. Unlayered, after globals.css: it wins. */}
        {styleFonts ? <link rel="stylesheet" href={styleFonts} /> : null}
        {styleCss ? <style data-site-style="" dangerouslySetInnerHTML={{ __html: styleCss }} /> : null}
        <SiteHeader signedIn={Boolean(viewer)} canEdit={Boolean(viewer?.canEdit)} email={viewer?.email ?? null} cartCount={cartCount} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        {viewer?.canEdit ? <SiteStyleButton initial={siteStyle} /> : null}
        <AnalyticsBeacon />
      </body>
    </html>
  );
}
