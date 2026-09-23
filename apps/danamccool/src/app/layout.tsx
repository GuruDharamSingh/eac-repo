import "@elkdonis/cms-ui/gallery.css";
// The ROOT layout, deliberately, not the published-page route.
//
// Puck's canvas is an iframe and its CopyHostStyles mirrors the parent
// document's <style>/<link> tags when it mounts. Next scopes a route's CSS
// import to that route, so a sheet imported only by /p/[slug] is ABSENT in
// /studio — blocks then draw unstyled in the editor, and Puck picks its drag
// axis from getComputedStyle, so even the drag-and-drop behaves wrongly.
import "@elkdonis/blocks/blocks.css";
// The media picker's styling, for the image field in the editor panel.
import "@elkdonis/cms-ui/files-card.css";
import "./globals.css";
// The HUD panels — imported at the root so the editor (Puck's parent
// document) and /hub both have them; see components/hud/hud.css.
import "@/components/hud/hud.css";
// The theme studio — /studio/theme and the editor's Theme tab.
import "@/components/studio/theme-studio.css";
// The Gallery grid's Pictures panel (editor right column).
import "@/components/studio/gallery-fields.css";
// Her blog (/blog) — the shared reader and shelf, the same as IFAC's.
import "@elkdonis/cms-ui/article.css";
import "@elkdonis/cms-ui/writing.css";
// The theme's hooks into the shared blocks' captions and subtitles. UNLAYERED
// on purpose — blocks.css is unlayered, and site.css sits in @layer base, so a
// rule there could never reach a `.blk-*` element. See theme-hooks.css.
import "./theme-hooks.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ComingSoonWall } from "@/components/coming-soon-wall";
import { siteConfig } from "@/config/site";
import { canBypassComingSoon, getViewer } from "@/lib/auth";
import { paletteCss } from "@/lib/theme";
import { loadFonts, loadPalette } from "@/lib/theme-store";
import { fontCss, fontsHrefFor, type SiteFonts } from "@/lib/fonts";
import { loadNav } from "@/lib/navigation-store";

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.orgName} — Artist`,
    template: `%s · ${siteConfig.orgName}`,
  },
  description:
    "Dana McCool, interdisciplinary artist, designer and writer. Surrealist paintings, mixed media, collage and installation work.",
};

/**
 * Every page reads the session (to offer editing to the site's owner), so
 * there's nothing meaningful to prerender — same reasoning as amrit-canada's
 * root layout.
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [viewer, palette, nav, fonts, reqHeaders] = await Promise.all([
    getViewer().catch(() => null),
    loadPalette().catch(() => ({})),
    loadNav().catch(() => []),
    loadFonts().catch((): SiteFonts => ({})),
    headers(),
  ]);
  // The site's fonts ride in the same <style> as its colours, for the same
  // reason (Puck's canvas mirrors <style>/<link> from the parent document).
  const css = [paletteCss(palette), fontCss(fonts)].filter(Boolean).join("\n");
  const fontsHref = fontsHrefFor(fonts);

  // Site-wide "in progress" wall (siteConfig.comingSoon). /login still
  // renders — inside the SAME minimal shell, so the real nav never leaks —
  // everything else shows the wall's own message instead of `children`.
  // middleware.ts forwards the pathname since a Server Component has no
  // direct route access.
  const isLoginPath = reqHeaders.get("x-pathname") === "/login";
  const gated = siteConfig.comingSoon && !(await canBypassComingSoon(viewer));

  return (
    <html lang="en" suppressHydrationWarning>
      {/*
        The site's colours, as Tailwind theme variables.

        A <style> rather than an inline style on <html>, because Puck's canvas
        is an iframe that mirrors the parent document's <style> and <link>
        elements — an attribute would be copied by nothing, and the editor
        would show the kits' own colours while the published page showed these.

        Unlayered, so it beats Tailwind's own values in @layer theme without
        needing !important or a specificity trick.
      */}
      {css ? (
        <style
          // `href` + `precedence` are React 19's hoisting contract, not
          // decoration: without them React warns that it "cannot render a
          // <style> outside the main document without knowing its precedence
          // and a unique href key", and a <style> as a direct child of <html>
          // is invalid HTML that produces a hydration error. With them, React
          // lifts this into <head> and dedupes it by href — which is also
          // where Puck's canvas looks when it mirrors the parent's styles.
          href="site-palette"
          precedence="high"
          dangerouslySetInnerHTML={{ __html: css }}
        />
      ) : null}
      {fontsHref ? (
        // React 19 hoists a stylesheet <link> with a `precedence` into <head>.
        <link rel="stylesheet" href={fontsHref} precedence="default" />
      ) : null}
      <body suppressHydrationWarning className="site-shell">
        {gated ? (
          <ComingSoonWall>{isLoginPath ? children : undefined}</ComingSoonWall>
        ) : (
          <>
            <SiteHeader canEdit={Boolean(viewer?.canEdit)} nav={nav} />
            <div className="site-content">
              <main>{children}</main>
              <SiteFooter />
            </div>
          </>
        )}
      </body>
    </html>
  );
}
