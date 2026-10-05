import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { getIdentity, type Viewer } from "@/lib/auth";
import { chartKeySet } from "@/lib/references-core";

/**
 * Who may read the explorer's references, and how much.
 *
 * Anyone who can view a chart (its owner account, or the guest cookie that
 * made it — the chart page's own rule) gets the factor keys, the reference
 * summaries and lists, footnotes and AI summaries for that chart. Without a
 * chartId the references are general (no fit to a chart) and open to anyone.
 *
 * The studio owner (org role "owner") additionally gets:
 *  - whole passages (others see excerpts of ≤ ~700 characters with full
 *    citation: the books' licences are unknown);
 *  - votes: their own marks and notes, and the Favourites list.
 * Everyone's ranking still follows the curator's votes (helpful first, tossed
 * last) — that is the point of the curation — but non-owners never see a
 * vote mark, note or count.
 */

export interface ExploreAccess {
  viewer: Viewer | null;
  isOwner: boolean;
  /** Whose votes rank the lists: the owner themself, or the curator for everyone else (null: nobody has voted). */
  rankBy: string | null;
  /** The chart's factor keys, when a chartId was given and may be viewed. */
  chart: Set<string> | null;
}

let curatorCache: { id: string | null; at: number } | null = null;

/** The org owner whose ref-votes curate the lists for everyone: the one who voted most recently. */
async function curatorId(): Promise<string | null> {
  if (curatorCache && Date.now() - curatorCache.at < 60_000) return curatorCache.id;
  const [row] = await db<{ user_id: string }[]>`
    SELECT u.user_id
    FROM user_organizations u
    LEFT JOIN LATERAL (
      SELECT max(r.created_at) AS last FROM astro_reviews r
      WHERE r.reviewer_id = u.user_id AND r.action = 'ref-vote' AND r.org_id = ${siteConfig.orgId}
    ) v ON TRUE
    WHERE u.org_id = ${siteConfig.orgId} AND u.role = 'owner'
    ORDER BY v.last DESC NULLS LAST, u.joined_at
    LIMIT 1
  `.catch(() => []);
  curatorCache = { id: row?.user_id ?? null, at: Date.now() };
  return curatorCache.id;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve access for a request. With a chartId the caller must be able to
 * view that chart (else 404, as the chart page); `requireChart` makes the
 * chartId mandatory.
 */
export async function exploreAccess(chartId: string | null, opts: { requireChart?: boolean } = {}): Promise<ExploreAccess | NextResponse> {
  const { viewer, keeper } = await getIdentity();
  const isOwner = viewer?.role === "owner";
  let chart: Set<string> | null = null;
  if (chartId || opts.requireChart) {
    if (!chartId || !UUID_RE.test(chartId) || !keeper) return NextResponse.json({ error: "Chart not found" }, { status: 404 });
    chart = await chartKeySet(chartId, keeper);
    if (!chart) return NextResponse.json({ error: "Chart not found" }, { status: 404 });
  }
  return { viewer, isOwner, rankBy: isOwner ? viewer!.userId : await curatorId(), chart };
}

/** Non-owners: at most this many items per page. */
export const PUBLIC_PAGE_MAX = 50;
