import { AnalyticsBeacon } from "@elkdonis/analytics/beacon";
import "./globals.css";
// App-scoped, not route-scoped, and that distinction is load-bearing. The
// editor renders blocks inside an iframe whose styles are mirrored from
// whatever is in the parent document's <head> AT THAT MOMENT. A stylesheet
// imported by the published route is only in the head while that route is
// mounted, so the editor canvas drew every block unstyled — the two-column
// block in particular stacked, and its layout controls looked like no-ops.
import "@elkdonis/blocks/blocks.css";
import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FieldsLensGate } from "@/components/fields/FieldsLensGate";
import { HubSurfaces } from "@/components/hub/HubSurfaces";
import { siteConfig } from "@/config/site";
import { ArrivalNotice } from "@elkdonis/cms-ui/network";
import { getViewer } from "@/lib/auth";
import { getProfile, listOrgFeeds } from "@elkdonis/services";
import { siteStyleCss, siteStyleFontsHref } from "@elkdonis/direct-edit/site";
import { loadSiteStyle } from "@/lib/site-style";
import { SITE_STYLE } from "@/lib/site-style-schema";
import { SiteStyleButton } from "@/components/site-style/SiteStyleButton";

export const metadata: Metadata = {
  title: {
    default: siteConfig.orgName,
    template: `%s · ${siteConfig.orgName}`,
  },
  description: siteConfig.tagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Every page is rendered per request: the header reads the session, and the
 * site is database-driven (feeds, gatherings, the landing's admin-set copy).
 *
 * The three faces — Venture, Brothers, Basteleur — are declared in
 * globals.css as @font-face over the files in public/fonts, exactly as
 * inner-gathering shipped them; no font loader, no Mantine.
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [viewer, feeds, siteStyle] = await Promise.all([
    getViewer().catch(() => null),
    listOrgFeeds(siteConfig.orgId, { includePrivate: true }).catch(() => []),
    // Site style: stored values over SITE_STYLE's defaults, as one <style>. Nothing stored
    // (today): null, and nothing extra is drawn.
    loadSiteStyle().catch(() => null),
  ]);
  const canEdit = Boolean(viewer?.canEdit);
  const styleCss = siteStyleCss(siteStyle, SITE_STYLE);
  const styleFonts = siteStyleFontsHref(siteStyle, SITE_STYLE);
  const profile = viewer ? await getProfile(viewer.userId).catch(() => null) : null;
  const talkBaseUrl =
    process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? process.env.NEXTCLOUD_PUBLIC_URL ?? null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="flex min-h-screen flex-col">
        {/* In <body> (as katie): a plain <style> keeps its data attribute. Loads after the
            site stylesheet, so a saved value wins. Absent until a style is saved. */}
        {styleFonts ? <link rel="stylesheet" href={styleFonts} /> : null}
        {styleCss ? <style data-site-style="" dangerouslySetInnerHTML={{ __html: styleCss }} /> : null}
        {/* One surface system for the whole site: a landing row, a feed row,
            a hub tile and a calendar day all open into the same dialog. */}
        <HubSurfaces
          signedIn={Boolean(viewer)}
          userId={viewer?.userId ?? null}
          canEdit={canEdit}
          displayName={profile?.displayName ?? null}
          feeds={feeds.filter((f) => f.isPublic || canEdit).map((f) => ({ slug: f.slug, name: f.name }))}
          talkBaseUrl={talkBaseUrl}
        >
          <SiteHeader
            feeds={feeds.filter((f) => f.isPublic).map((f) => ({ slug: f.slug, name: f.name }))}
            signedIn={Boolean(viewer)}
            canEdit={canEdit}
            isMember={Boolean(viewer?.isMember)}
          />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <FieldsLensGate />
          <Toaster position="top-right" />
          <ArrivalNotice endpoint="/api/network/arrival" />
          {canEdit ? <SiteStyleButton initial={siteStyle} /> : null}
        </HubSurfaces>
        <AnalyticsBeacon />
      </body>
    </html>
  );
}
