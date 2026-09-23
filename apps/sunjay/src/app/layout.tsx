import "./globals.css";
import type { Metadata } from "next";
import { Fraunces, Spectral } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HubSurfaces } from "@/components/hub/HubSurfaces";
import { siteConfig } from "@/config/site";
import { getSiteSections } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { getProfile, listOrgFeeds } from "@elkdonis/services";

/**
 * Fraunces for display, Spectral for reading — a soft-serif with real weight
 * over a text serif built for long passages. Deliberately not amrit-canada's
 * Cinzel/Lora: the two sites share a codebase, not a voice.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
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

  // "general" is the forum's private catch-all, not a page — see migration 150.
  const offerings = feeds
    .filter((f) => f.isPublic && f.slug !== "general")
    .map((f) => ({ slug: f.slug, title: f.name }));

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${spectral.variable}`}
    >
      {/*
        No decorative side panel. amrit-canada runs a full-height paper.js
        canvas spelling KUNDALINI down the left of every page; that is its
        practice, not this one, and the component was deleted here rather
        than left in the tree to be wondered about later.
      */}
      <body suppressHydrationWarning className="flex min-h-screen flex-col">
        {/* One surface system for the whole site: a listing card on a feed
            page, a hub tile and a calendar day all open into the same dialog.

            This lives in the LAYOUT, not the hub page, and it is load-bearing
            for the landing page: StandingMeetingFace, CalendarFace and
            GalleryFace all call useSurface(), which THROWS outside a provider.
            The public front page renders all three. */}
        <HubSurfaces
          signedIn={Boolean(viewer)}
          userId={viewer?.userId ?? null}
          canEdit={canEdit}
          displayName={profile?.displayName ?? null}
          feeds={feeds
            .filter((f) => f.isPublic || canEdit)
            .map((f) => ({ slug: f.slug, name: f.name }))}
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
        </HubSurfaces>
      </body>
    </html>
  );
}
