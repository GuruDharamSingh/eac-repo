// CONTRACT: reviews reads (server only): public list + summaries for places, tours, experiences. Types in lib/catalogue-types.ts.
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import type { Review, ReviewSummary, ReviewTarget, ReviewTargetType } from "@/lib/catalogue-types";

/**
 * org_reviews (migration 238). Public to read: visible reviews only, unless the
 * caller passes `includeHidden` (editors). Writes are in review-actions.ts.
 */

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const TYPES: ReviewTargetType[] = ["place", "tour", "experience"];
const iso = (v: unknown) => new Date(v as string).toISOString();

export function validTarget(t: ReviewTarget | null | undefined): t is ReviewTarget {
  if (!t || !TYPES.includes(t.type) || typeof t.id !== "string") return false;
  return t.type === "place" ? /^[0-9a-f-]{36}$/i.test(t.id) : /^[\w-]{1,21}$/.test(t.id);
}

/** The target exists on this site (and, for tours/experiences, is published + public: what people can review). */
export async function targetExists(t: ReviewTarget, opts: { publicOnly?: boolean } = {}): Promise<boolean> {
  if (!validTarget(t)) return false;
  const rows = (t.type === "place"
    ? await db`SELECT 1 FROM places WHERE id = ${t.id} AND org_id = ${ORG} AND archived_at IS NULL`
    : await db`
        SELECT 1 FROM threads WHERE id = ${t.id} AND org_id = ${ORG} AND kind = ${t.type}
          ${opts.publicOnly === false ? db`` : db`AND status = 'published' AND visibility = 'PUBLIC'`}
      `) as unknown as Row[];
  return rows.length > 0;
}

function mapReview(r: Row, viewerId: string | null, editor: boolean): Review {
  return {
    id: r.id as string,
    target: { type: r.target_type as ReviewTargetType, id: r.target_id as string },
    rating: r.rating == null ? null : Number(r.rating),
    body: (r.body as string | null) ?? null,
    status: r.status as "visible" | "hidden",
    author: {
      userId: r.user_id as string,
      name: (r.display_name as string | null) ?? "A guest",
      slug: (r.slug as string | null) ?? null,
      avatarUrl: (r.avatar as string | null) ?? null,
    },
    mine: viewerId != null && r.user_id === viewerId,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    hiddenReason: editor ? ((r.hidden_reason as string | null) ?? null) : null,
  };
}

export async function listReviews(
  target: ReviewTarget,
  opts: { viewerId?: string | null; includeHidden?: boolean; limit?: number } = {}
): Promise<Review[]> {
  if (!validTarget(target)) return [];
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  try {
    const rows = (await db`
      SELECT r.*, u.display_name, u.slug, COALESCE(op.photo_override, u.avatar_url) AS avatar
      FROM org_reviews r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN org_profiles op ON op.user_id = r.user_id AND op.org_id = r.org_id
      WHERE r.org_id = ${ORG} AND r.target_type = ${target.type} AND r.target_id = ${target.id}
        ${opts.includeHidden ? db`` : db`AND (r.status = 'visible' ${opts.viewerId ? db`OR r.user_id = ${opts.viewerId}` : db``})`}
      ORDER BY r.created_at DESC
      LIMIT ${limit}
    `) as unknown as Row[];
    return rows.map((r) => mapReview(r, opts.viewerId ?? null, !!opts.includeHidden));
  } catch (err) {
    console.error("[elktours] listReviews:", err);
    return [];
  }
}

/** Visible-review counts and average rating, batched for cards and lists. Every target gets an entry. */
export async function reviewSummaries(targets: ReviewTarget[]): Promise<Map<string, ReviewSummary>> {
  const out = new Map<string, ReviewSummary>();
  const valid = targets.filter(validTarget);
  for (const t of valid) out.set(`${t.type}:${t.id}`, { target: t, count: 0, ratedCount: 0, average: null });
  if (valid.length === 0) return out;
  try {
    const keys = valid.map((t) => `${t.type}:${t.id}`);
    const rows = (await db`
      SELECT target_type, target_id, COUNT(*)::int AS n, COUNT(rating)::int AS rated, AVG(rating)::float AS avg
      FROM org_reviews
      WHERE org_id = ${ORG} AND status = 'visible' AND (target_type || ':' || target_id) = ANY(${keys})
      GROUP BY target_type, target_id
    `) as unknown as Row[];
    for (const r of rows) {
      const k = `${r.target_type}:${r.target_id}`;
      const s = out.get(k);
      if (!s) continue;
      s.count = Number(r.n);
      s.ratedCount = Number(r.rated);
      s.average = r.avg == null ? null : Math.round(Number(r.avg) * 10) / 10;
    }
  } catch (err) {
    console.error("[elktours] reviewSummaries:", err);
  }
  return out;
}

export async function reviewSummary(target: ReviewTarget): Promise<ReviewSummary> {
  return (await reviewSummaries([target])).get(`${target.type}:${target.id}`) ?? { target, count: 0, ratedCount: 0, average: null };
}
