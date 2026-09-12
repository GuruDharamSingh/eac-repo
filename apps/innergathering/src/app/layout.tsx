import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HubSurfaces } from "@/components/hub/HubSurfaces";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { getProfile, listOrgFeeds } from "@elkdonis/services";

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
  const [viewer, feeds] = await Promise.all([
    getViewer().catch(() => null),
    listOrgFeeds(siteConfig.orgId, { includePrivate: true }).catch(() => []),
  ]);
  const canEdit = Boolean(viewer?.canEdit);
  const profile = viewer ? await getProfile(viewer.userId).catch(() => null) : null;
  const talkBaseUrl =
    process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? process.env.NEXTCLOUD_PUBLIC_URL ?? null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="flex min-h-screen flex-col">
        {/* One surface system for the whole site: a landing row, a feed row,
            a hub tile and a calendar day all open into the same dialog. */}
        <HubSurfaces
          signedIn={Boolean(viewer)}
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
          <Toaster position="top-right" />
        </HubSurfaces>
      </body>
    </html>
  );
}
