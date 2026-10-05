import "./globals.css";
import type { Metadata } from "next";
import { Cinzel, Lora } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HubSurfaces } from "@/components/hub/HubSurfaces";
import { siteConfig } from "@/config/site";
import { ArrivalNotice } from "@elkdonis/cms-ui/network";
import { AnalyticsBeacon } from "@elkdonis/analytics/beacon";
import { getSiteSections } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { getProfile, listOrgFeeds } from "@elkdonis/services";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.orgName,
    template: `%s · ${siteConfig.orgName}`,
  },
  description: siteConfig.tagline,
};

/**
 * Every page is rendered per request.
 *
 * The header reads the session to decide between "Sign in" and "Account", and
 * the whole site is database-driven (feeds, gatherings, cycle status), so
 * there is nothing meaningful to prerender. Saying so explicitly avoids Next
 * attempting static generation and failing on the cookie read.
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nav is built from org_feeds, so adding a section to the site is a database
  // row rather than a code change.
  const [viewer, sections] = await Promise.all([
    getViewer().catch(() => null),
    getSiteSections(),
  ]);
  const canEdit = Boolean(viewer?.canEdit);
  const [feeds, profile] = await Promise.all([
    // Editors compose into private feeds too; visitors only see public ones.
    listOrgFeeds(siteConfig.orgId, { includePrivate: canEdit }).catch(() => []),
    viewer ? getProfile(viewer.userId).catch(() => null) : null,
  ]);
  const talkBaseUrl =
    process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? process.env.NEXTCLOUD_PUBLIC_URL ?? null;
  // "Offerings" in the nav is the site's actual content channels, not the
  // (now-unused) "services" feed -- Amrit Vela Sadhana, Yoga Classes,
  // Gurdwara & Langar. "general" is private and excluded.
  const offerings = feeds
    .filter((f) => f.isPublic && f.slug !== "services")
    .map((f) => ({ slug: f.slug, title: f.name }));

  return (
    <html lang="en" suppressHydrationWarning className={`${cinzel.variable} ${lora.variable}`}>
      {/* The left-column Kundalini animation (components/kundalini-panel*)
          was taken off 2026-09-26; the component is kept for reuse. */}
      <body suppressHydrationWarning className="flex min-h-screen">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* One surface system for the whole site: a listing card on a feed
              page, a hub tile and a calendar day all open into the same dialog. */}
          <HubSurfaces
            signedIn={Boolean(viewer)}
            userId={viewer?.userId ?? null}
            canEdit={canEdit}
            displayName={profile?.displayName ?? null}
            feeds={feeds.filter((f) => f.isPublic || canEdit).map((f) => ({ slug: f.slug, name: f.name }))}
            talkBaseUrl={talkBaseUrl}
          >
            <SiteHeader
              signedIn={Boolean(viewer)}
              canEdit={canEdit}
              isMember={Boolean(viewer?.isMember)}
              offerings={offerings}
            />
            <main className="flex-1">{children}</main>
            <SiteFooter content={sections.footer} />
            <Toaster position="top-right" />
            <ArrivalNotice endpoint="/api/network/arrival" />
            <AnalyticsBeacon />
          </HubSurfaces>
        </div>
      </body>
    </html>
  );
}
