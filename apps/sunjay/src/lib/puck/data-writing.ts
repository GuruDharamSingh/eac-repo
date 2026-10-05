import { getWritingPost, listOrgWriting } from "@elkdonis/services";
import type { OrgWritingSummary } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import type { WireJournalItem, WirePost } from "@/blocks/writing-sample";

// ============================================================================
// The writing behind the writing blocks.
//
// A Studio piece is `kind = 'writing'`, homed on the author's own space and
// listed on this site through `thread_orgs` ("Show on"). It is not in a feed,
// so sunjay's section-scoped thread route never finds it; these loaders read
// through `listOrgWriting` (pieces shown on this org) instead. A piece is found
// among that list before it is read, so an address here can never serve a piece
// that is not shown on this site.
//
// Pieces live at /journal/<slug> (app/journal/[piece]/page.tsx).
// ============================================================================

export const JOURNAL_BASE = "/journal";
const ORG = siteConfig.orgId;

const iso = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString() : null);

export function toJournalItem(s: OrgWritingSummary): WireJournalItem {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    lede: s.lede,
    coverImageUrl: s.coverImageUrl,
    publishedAt: iso(s.publishedAt),
    readingMinutes: s.readingMinutes,
    authorName: s.author.name,
    series: s.series,
    href: `${JOURNAL_BASE}/${s.slug}`,
  };
}

export async function loadJournal(props: Record<string, unknown>): Promise<{ items: WireJournalItem[] }> {
  const limit = typeof props.limit === "number" ? Math.min(Math.max(Math.trunc(props.limit), 1), 50) : 12;
  const listed = await listOrgWriting(ORG, { limit: 50 }).catch(() => []);
  const series = typeof props.series === "string" ? props.series.trim() : "";
  const rows = series ? listed.filter((p) => p.series === series) : listed;
  return { items: rows.slice(0, limit).map(toJournalItem) };
}

/** The piece for this page: `metadata.piece`, else the block's own choice, else the newest. */
export async function loadPiece(
  props: Record<string, unknown>,
  ctx: Record<string, unknown>
): Promise<{ post: WirePost | null }> {
  const wanted = (typeof ctx.piece === "string" && ctx.piece) || (typeof props.piece === "string" && props.piece) || "";
  const listed = await listOrgWriting(ORG, { limit: 50 }).catch(() => []);
  const hit = (wanted ? listed.find((p) => p.slug === wanted) : null) ?? (wanted ? null : listed[0] ?? null);
  if (!hit) return { post: null };
  const post = await getWritingPost(hit.author.id, hit.slug);
  if (!post) return { post: null };
  return {
    post: {
      id: post.id,
      slug: post.slug,
      title: post.title,
      lede: post.lede,
      bodyHtml: post.bodyHtml,
      coverImageUrl: post.coverImageUrl,
      layout: post.layout,
      series: post.series,
      authorName: hit.author.name,
      bylineName: post.byline?.name ?? null,
      readingMinutes: post.readingMinutes,
      publishedAt: iso(post.publishedAt),
    },
  };
}

/** The pieces filed under the same series as this page's piece, in the order written. */
export async function loadSeries(
  props: Record<string, unknown>,
  ctx: Record<string, unknown>
): Promise<{ items: WireJournalItem[]; series: string | null; current: string | null }> {
  const { post } = await loadPiece({}, ctx);
  const series = post?.series ?? null;
  if (!series) return { items: [], series: null, current: post?.slug ?? null };
  const listed = await listOrgWriting(ORG, { limit: 50 }).catch(() => []);
  const items = listed
    .filter((p) => p.series === series)
    .reverse()
    .map(toJournalItem);
  void props;
  return { items, series, current: post?.slug ?? null };
}
