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
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { paletteCss } from "@/lib/theme";
import { loadPalette } from "@/lib/theme-store";
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
  const [viewer, palette, nav] = await Promise.all([
    getViewer().catch(() => null),
    loadPalette().catch(() => ({})),
    loadNav().catch(() => []),
  ]);
  const css = paletteCss(palette);

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
      <body suppressHydrationWarning className="site-shell">
        <SiteHeader canEdit={Boolean(viewer?.canEdit)} nav={nav} />
        <div className="site-content">
          <main>{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
