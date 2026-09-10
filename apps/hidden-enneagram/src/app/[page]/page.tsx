import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SilexSiteBySlug } from "@elkdonis/silex-render";
import { canViewFeed, getOrgFeed } from "@elkdonis/services";
import { SiteNav } from "@/components/site-nav";
import { FeedListing } from "@/components/feed-listing";
import { getViewer } from "@/lib/auth";
import { ORG_SLUG } from "@/lib/session";
import { siteConfig } from "@/config/site";

/**
 * One dynamic segment, two kinds of page.
 *
 * Next.js allows only one slug name per path position, so the Silex pages and
 * the database-driven feeds share this route and are told apart here:
 *
 *   1. a slug in SILEX_PAGES  → the published Silex page from Nextcloud
 *   2. a slug in org_feeds    → the feed listing (writing, inner-work, …)
 *   3. neither                → 404
 *
 * Silex wins ties on purpose: those pages are already published and linked,
 * and a feed row added later shouldn't silently take over a live URL.
 *
 * /services, /about, /hub and /triads are static routes and take precedence
 * over this segment entirely.
 */

// The published pages seeded into Nextcloud (besides index → "/").
const SILEX_PAGES = new Set([
  "introduction",
  "centers",
  "contact",
  "type-1",
  "type-2",
  "type-3",
  "type-4",
  "type-5",
  "type-6",
  "type-7",
  "type-8",
  "type-9",
]);

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ page: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  if (SILEX_PAGES.has(page)) return {};

  const feed = await getOrgFeed(siteConfig.orgId, page);
  if (!feed) return {};
  return {
    title: feed.name,
    description: feed.tagline ?? feed.description ?? undefined,
    // Members-only sections have no business in search results.
    robots: feed.minRole ? { index: false, follow: false } : undefined,
  };
}

export default async function SitePage({ params }: PageProps) {
  const { page } = await params;

  if (SILEX_PAGES.has(page)) {
    return (
      <>
        <SiteNav />
        <SilexSiteBySlug
          slug={ORG_SLUG}
          page={page}
          cssLinks={["/api/silex/templates/enneagram.css"]}
          omitSections={["eac-enn-nav"]}
        />
      </>
    );
  }

  const [feed, viewer] = await Promise.all([
    getOrgFeed(siteConfig.orgId, page),
    getViewer(),
  ]);
  if (!feed) notFound();

  // A locked feed 404s rather than 403-ing: a members-only section shouldn't
  // confirm its own existence to someone who can't open it.
  if (!canViewFeed(feed, viewer?.role ?? null)) notFound();

  return <FeedListing feed={feed} isMember={Boolean(viewer?.isMember)} />;
}
