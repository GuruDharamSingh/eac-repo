import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { canViewFeed, getOrgFeed } from "@elkdonis/services";
import { FeedListing } from "@/components/feed-listing";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { PuckPage, pageData, titleOf } from "@/lib/puck/render";
import { ELSEWHERE_SLUGS, ROUTE_SLUGS } from "@/lib/puck/store";
import { readingMetadata } from "@/lib/reading-privacy";

/**
 * One dynamic segment, two kinds of page, tried in this order:
 *
 *   1. a studio page published at this address (site_config puck:<slug>)
 *   2. a slug in org_feeds    -> the feed listing (writing, inner-work, ...)
 *   3. none of them           -> 404
 *
 * The studio refuses feed slugs and this app's own routes, so 1 can never
 * hide a feed or a route. (Round 5: the Silex step is gone; no Silex page
 * was left after round 3.)
 *
 * /services/*, /about, /readings, /hub, /enneagram are static routes and take
 * precedence over this segment entirely. Round 3: /introduction, /centers,
 * /triads, /type-N, /contact and /services redirect in next.config.ts.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ page: string }>;
}

// Round 3: not the documents drawn elsewhere (home is /, service is every /services/<slug>).
const studioPage = (slug: string) => (ROUTE_SLUGS.has(slug) || ELSEWHERE_SLUGS.has(slug) ? Promise.resolve(null) : pageData(slug));

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const built = await studioPage(page);
  // A page holding a reading is about one person: noindex, no referrer (lib/reading-privacy.ts).
  if (built) return { title: titleOf(built) ?? page.replace(/-/g, " "), ...readingMetadata(built) };

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

  const built = await studioPage(page);
  if (built) return <PuckPage slug={page} data={built} />;

  const [feed, viewer] = await Promise.all([getOrgFeed(siteConfig.orgId, page), getViewer()]);
  if (!feed) notFound();

  // A locked feed 404s rather than 403-ing: a members-only section shouldn't
  // confirm its own existence to someone who can't open it.
  if (!canViewFeed(feed, viewer?.role ?? null)) notFound();

  return <FeedListing feed={feed} isMember={Boolean(viewer?.isAffiliate)} />;
}
