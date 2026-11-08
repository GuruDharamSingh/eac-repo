import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SilexSiteBySlug } from "@elkdonis/silex-render";
import { canViewFeed, getOrgFeed } from "@elkdonis/services";
import { FeedListing } from "@/components/feed-listing";
import { EditPageButton } from "@/components/edit-page-button";
import { getViewer } from "@/lib/auth";
import { ORG_SLUG } from "@/lib/session";
import { siteConfig } from "@/config/site";
import { SILEX_PAGES } from "@/lib/silex-pages";
import { PuckPage, pageData, titleOf } from "@/lib/puck/render";
import { ELSEWHERE_SLUGS, ROUTE_SLUGS } from "@/lib/puck/store";
import { readingMetadata } from "@/lib/reading-privacy";

/**
 * One dynamic segment, three kinds of page, tried in this order:
 *
 *   1. a studio page published at this address (site_config puck:<slug>)
 *   2. a slug in SILEX_PAGES  -> the published Silex page from Nextcloud
 *   3. a slug in org_feeds    -> the feed listing (writing, inner-work, ...)
 *   4. none of them           -> 404
 *
 * A studio page wins over Silex on purpose (2026-11-07): publishing one at
 * /introduction or /type-4 is how a Silex page moves into the page builder,
 * one at a time, without a deploy. The studio refuses feed slugs and this
 * app's own routes, so 1 can never hide a feed or a route.
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

  const built = await studioPage(page);
  if (built) return <PuckPage slug={page} data={built} />;

  if (SILEX_PAGES.has(page)) {
    const viewer = await getViewer().catch(() => null);
    return (
      <>
        <SilexSiteBySlug
          slug={ORG_SLUG}
          page={page}
          cssLinks={["/api/silex/templates/enneagram.css"]}
          omitSections={["eac-enn-nav"]}
        />
        {/* Editors: this page still lives in Silex; "Edit page" opens it there. */}
        {viewer?.canEdit ? (
          <div className="he-silex-edit" data-de-ui="">
            <EditPageButton page={page} className="he-btn" />
          </div>
        ) : null}
      </>
    );
  }

  const [feed, viewer] = await Promise.all([getOrgFeed(siteConfig.orgId, page), getViewer()]);
  if (!feed) notFound();

  // A locked feed 404s rather than 403-ing: a members-only section shouldn't
  // confirm its own existence to someone who can't open it.
  if (!canViewFeed(feed, viewer?.role ?? null)) notFound();

  return <FeedListing feed={feed} isMember={Boolean(viewer?.isMember)} />;
}
