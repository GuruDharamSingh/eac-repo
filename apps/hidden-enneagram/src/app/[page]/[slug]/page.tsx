import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { canViewFeed, getOrgFeed } from "@elkdonis/services";
import { getThreadBySlug } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { PuckPage, pageData } from "@/lib/puck/render";
import { POST_SLUG } from "@/lib/puck/store";
import { withRouteProps } from "@/lib/puck/route-props";
import { DEFAULT_POST_PAGE } from "@/lib/default-pages";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ page: string; slug: string }>;
}

function plain(html: string | null, max = 160): string | undefined {
  if (!html) return undefined;
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page: feedSlug, slug } = await params;
  const [feed, viewer] = await Promise.all([
    getOrgFeed(siteConfig.orgId, feedSlug),
    getViewer(),
  ]);
  if (!feed || !canViewFeed(feed, viewer?.role ?? null)) return {};

  const thread = await getThreadBySlug(feedSlug, slug, { isMember: Boolean(viewer?.isAffiliate) });
  if (!thread) return {};

  const nonPublic = Boolean(feed.minRole) || thread.visibility === "ORGANIZATION";
  return {
    title: thread.title,
    description: thread.excerpt ?? plain(thread.description),
    robots: nonPublic ? { index: false, follow: false } : undefined,
    openGraph: thread.coverImageUrl ? { images: [thread.coverImageUrl] } : undefined,
  };
}

/**
 * One post at `/<feed>/<slug>` (round 6): the studio document `post` (one
 * template for every article; DEFAULT_POST_PAGE until published) around
 * he-post, which draws the post in the address (lib/record-blocks.ts
 * loadPostBlock, the same reads and rules as here).
 *
 * The gates stay HERE and run first, unchanged: an unknown or locked feed
 * 404s (a members-only section shouldn't confirm its own existence), and the
 * read itself is member-aware, so an ORGANIZATION-visibility post inside a
 * public feed is equally unreachable to a signed-out visitor with the direct
 * link: the gate is the query, not the link.
 */
export default async function ThreadPage({ params }: PageProps) {
  const { page: feedSlug, slug } = await params;
  const [feed, viewer] = await Promise.all([
    getOrgFeed(siteConfig.orgId, feedSlug),
    getViewer(),
  ]);

  if (!feed || !canViewFeed(feed, viewer?.role ?? null)) notFound();

  const thread = await getThreadBySlug(feedSlug, slug, {
    isMember: Boolean(viewer?.isAffiliate),
  });
  if (!thread) notFound();

  const data = await pageData(POST_SLUG, DEFAULT_POST_PAGE);
  if (!data) notFound();
  return <PuckPage slug={POST_SLUG} data={withRouteProps(data, "he-post", { routeFeed: feedSlug, routeSlug: slug })} />;
}
