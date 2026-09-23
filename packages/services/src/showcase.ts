import { db } from '@elkdonis/db';
import { OFF_FEED_KINDS } from './thread-kinds';
import { canModerateOrg } from './moderation';

// ============================================================================
// The showcase — an org's published work as one plain digest.
//
// Everything PUBLIC the org has put out, whoever made it: a meeting, a piece
// of writing, a work for sale, a member's blog entry. Deliberately not the
// hub's feed (which is for members and includes org-only things) and not the
// forum (which is a conversation): this is the reading shelf a visitor sees.
//
// What it will NOT show, by construction:
//   · anything not `status = 'published'` — a draft, and a submission still
//     waiting on a guide (moderation.ts);
//   · anything whose visibility is not PUBLIC;
//   · the kinds that are not feed items at all (OFF_FEED_KINDS: a wiki page,
//     a document, a member's writing shelf entry is reached from their page).
// ============================================================================

const CARD_SIZE_KEY = 'showcase:card-size';

export type ShowcaseCardSize = 'small' | 'medium' | 'large';
const SIZES: ShowcaseCardSize[] = ['small', 'medium', 'large'];

export interface ShowcaseItem {
  id: string;
  title: string;
  kind: string;
  slug: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  section: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  pinned: boolean;
  authorName: string | null;
  authorSlug: string | null;
  authorAvatar: string | null;
}

export interface ShowcasePage {
  /** The pinned piece, for the hero. Null when nothing is pinned. */
  lead: ShowcaseItem | null;
  /** Everything else, newest first, the lead excluded. */
  items: ShowcaseItem[];
  /** True when another page of items exists. */
  more: boolean;
}

/**
 * One page of the digest.
 *
 * `section` narrows to an org feed (the side index). The lead is the pinned
 * thread — the most recently published one if several are pinned — and is
 * lifted out of the list so it cannot appear twice.
 */
export async function getShowcase(
  orgId: string,
  opts: { section?: string | null; limit?: number; offset?: number } = {}
): Promise<ShowcasePage> {
  const limit = Math.min(Math.max(opts.limit ?? 24, 1), 60);
  const offset = Math.max(opts.offset ?? 0, 0);
  const section = opts.section?.trim() || null;

  const rows = await db<Array<Record<string, unknown>>>`
    SELECT t.id, t.title, t.kind, t.slug, t.excerpt, t.section,
           -- The cover lives in metadata, not a column of its own (same read
           -- as center.ts's activity query).
           t.metadata->>'coverImageUrl' AS cover_image_url,
           t.published_at, t.scheduled_at, t.pinned,
           u.display_name, u.slug AS author_slug, u.avatar_url
    FROM threads t
    LEFT JOIN users u ON u.id = t.author_id
    WHERE t.org_id = ${orgId}
      AND t.status = 'published'
      AND t.visibility = 'PUBLIC'
      AND t.kind <> ALL(${OFF_FEED_KINDS})
      ${section ? db`AND t.section = ${section}` : db``}
    ORDER BY t.pinned DESC, COALESCE(t.published_at, t.scheduled_at, t.created_at) DESC
    LIMIT ${limit + 1} OFFSET ${offset}
  `;

  const more = rows.length > limit;
  const items = rows.slice(0, limit).map(toItem);
  // Only the first page carries the hero; page two is a continuation of the
  // list, and hoisting the pinned piece again there would repeat it.
  const lead = offset === 0 && items[0]?.pinned ? items[0] : null;
  return { lead, items: lead ? items.slice(1) : items, more };
}

export interface ShowcaseSection {
  slug: string;
  name: string;
  count: number;
}

/**
 * The side index: the sections that actually HAVE something public here.
 *
 * Derived from the content rather than read off `org_feeds.is_public`,
 * deliberately. That flag says whether a section is a public part of the
 * site's own navigation; several of IFAC's real categories are marked private
 * while still holding posts their authors published publicly, and an index
 * built from the flag listed one section out of four. A section appears here
 * when a visitor can read something in it, which is the only thing the index
 * is for. The name comes from `org_feeds` when the section is one; a section
 * with no feed row shows its own slug.
 */
export async function listShowcaseSections(orgId: string): Promise<ShowcaseSection[]> {
  const rows = await db<Array<{ slug: string; name: string | null; n: number }>>`
    SELECT t.section AS slug, f.name, COUNT(*)::int AS n
    FROM threads t
    LEFT JOIN org_feeds f ON f.org_id = t.org_id AND f.slug = t.section
    WHERE t.org_id = ${orgId}
      AND t.status = 'published'
      AND t.visibility = 'PUBLIC'
      AND t.kind <> ALL(${OFF_FEED_KINDS})
      AND t.section IS NOT NULL
    GROUP BY t.section, f.name, f.sort_order
    ORDER BY f.sort_order NULLS LAST, COUNT(*) DESC
  `;
  return rows.map((r) => ({ slug: r.slug, name: r.name ?? r.slug, count: r.n }));
}

/** How big the cards are on this org's showcase. Set by its guides. */
export async function getShowcaseCardSize(orgId: string): Promise<ShowcaseCardSize> {
  const [row] = await db<Array<{ value: unknown }>>`
    SELECT value FROM site_config WHERE org_id = ${orgId} AND key = ${CARD_SIZE_KEY} LIMIT 1
  `;
  const value = (row?.value as { size?: string } | undefined)?.size;
  return SIZES.includes(value as ShowcaseCardSize) ? (value as ShowcaseCardSize) : 'medium';
}

/** Moderators only — the control sits on the page itself, for a signed-in guide. */
export async function setShowcaseCardSize(
  userId: string,
  orgId: string,
  size: string
): Promise<{ ok: true; size: ShowcaseCardSize } | { ok: false; error: string }> {
  if (!SIZES.includes(size as ShowcaseCardSize)) return { ok: false, error: 'Unknown size.' };
  if (!(await canModerateOrg(userId, orgId))) {
    return { ok: false, error: 'Only an owner or guide can change this.' };
  }
  await db`
    INSERT INTO site_config (org_id, key, value, updated_at)
    VALUES (${orgId}, ${CARD_SIZE_KEY}, ${db.json({ size })}, NOW())
    ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
  return { ok: true, size: size as ShowcaseCardSize };
}

function toItem(r: Record<string, unknown>): ShowcaseItem {
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    id: String(r.id),
    title: String(r.title ?? 'Untitled'),
    kind: String(r.kind),
    slug: (r.slug as string | null) ?? null,
    excerpt: (r.excerpt as string | null) ?? null,
    coverImageUrl: (r.cover_image_url as string | null) ?? null,
    section: (r.section as string | null) ?? null,
    publishedAt: iso(r.published_at),
    scheduledAt: iso(r.scheduled_at),
    pinned: Boolean(r.pinned),
    authorName: (r.display_name as string | null) ?? null,
    authorSlug: (r.author_slug as string | null) ?? null,
    authorAvatar: (r.avatar_url as string | null) ?? null,
  };
}
