import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { getProfileBySlug, type Profile } from './profiles';
import type { ForumPerson, ForumScope, ForumViewer, Paged } from './forum';

// ============================================================================
// The Grand Forum — people and taxonomy reads (phase 3).
//
// Identity comes from the same `users` row ArtDirect renders; the forum adds
// only what a board knows about a person — roles, joined, counts, activity.
// ============================================================================

export interface ForumRoleLine {
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: string;
}

/** What the hover card shows: identity plus the board's facts about them. */
export interface ForumPersonCard extends ForumPerson {
  headline: string | null;
  pronouns: string | null;
  city: string | null;
  joinedAt: Date;
  topicCount: number;
  replyCount: number;
  roles: ForumRoleLine[];
}

export interface ForumMember extends ForumPersonCard {
  profile: Profile;
}

const CARD_SQL = db`
  u.id, u.slug, COALESCE(u.display_name, 'Someone') AS name, u.avatar_url, u.comment_color,
  u.headline, u.pronouns, u.city, u.created_at AS joined_at,
  (SELECT COUNT(*)::int FROM threads t WHERE t.author_id = u.id AND t.status = 'published') AS topic_count,
  (SELECT COUNT(*)::int FROM replies r WHERE r.user_id = u.id) AS reply_count,
  COALESCE((
    SELECT json_agg(json_build_object('orgId', o.id, 'orgSlug', o.slug, 'orgName', o.name, 'role', uo.role) ORDER BY o.name)
    FROM user_organizations uo JOIN organizations o ON o.id = uo.org_id WHERE uo.user_id = u.id
  ), '[]'::json) AS roles
`;

type CardRow = {
  id: string; slug: string | null; name: string; avatar_url: string | null; comment_color: string | null;
  headline: string | null; pronouns: string | null; city: string | null; joined_at: Date;
  topic_count: number; reply_count: number; roles: ForumRoleLine[];
};

function card(r: CardRow): ForumPersonCard {
  return {
    id: r.id, slug: r.slug, name: r.name, avatarUrl: r.avatar_url, commentColor: r.comment_color,
    headline: r.headline, pronouns: r.pronouns, city: r.city, joinedAt: r.joined_at,
    topicCount: r.topic_count, replyCount: r.reply_count, roles: r.roles ?? [],
  };
}

/** Cards for every author on a page, in one query. */
export async function listPeopleCards(userIds: string[]): Promise<Record<string, ForumPersonCard>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return {};
  const rows = await db<CardRow[]>`SELECT ${CARD_SQL} FROM users u WHERE u.id = ANY(${ids}::uuid[])`;
  return Object.fromEntries(rows.map((r) => [r.id, card(r)]));
}

export async function getMember(slug: string): Promise<ForumMember | null> {
  const profile = await getProfileBySlug(slug);
  if (!profile) return null;
  const [row] = await db<CardRow[]>`SELECT ${CARD_SQL} FROM users u WHERE u.id = ${profile.userId}::uuid`;
  if (!row) return null;
  return { ...card(row), profile };
}

export interface ForumActivityItem {
  kind: 'topic' | 'reply';
  id: string;
  threadId: string;
  threadSlug: string;
  threadTitle: string;
  excerpt: string;
  at: Date;
  org: { slug: string; name: string };
  feed: { slug: string; name: string | null };
}

/** Wiki pages are excluded for every viewer — they are not forum topics. */
function visibleThreads(viewer: ForumViewer) {
  if (viewer.isGlobalAdmin) return db`t.status = 'published' AND t.kind <> 'wiki_page'`;
  const orgs = Object.keys(viewer.roles);
  return db`t.status = 'published' AND t.kind <> 'wiki_page' AND (t.visibility = 'PUBLIC' OR (t.visibility = 'ORGANIZATION' AND t.org_id = ANY(${orgs})) OR (${viewer.userId}::uuid IS NOT NULL AND t.author_id = ${viewer.userId}::uuid))`;
}

const PLAIN = (col: ReturnType<typeof db>) => db`LEFT(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(${col}, ''), '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g'), 160)`;

/** Topics started and replies posted, newest first, only in threads the viewer may see. */
export async function listMemberActivity(
  userId: string,
  viewer: ForumViewer,
  opts: { page?: number; limit?: number; only?: 'topic' | 'reply' } = {}
): Promise<Paged<ForumActivityItem>> {
  const limit = Math.min(opts.limit ?? 25, 100);
  const page = Math.max(opts.page ?? 1, 1);
  const offset = (page - 1) * limit;
  const only = opts.only ? db`WHERE kind = ${opts.only}` : db``;
  const base = db`
    SELECT 'topic'::text AS kind, t.id, t.id AS thread_id, t.slug AS thread_slug, t.title AS thread_title,
           ${PLAIN(db`t.body`)} AS excerpt, COALESCE(t.published_at, t.created_at) AS at,
           o.slug AS org_slug, o.name AS org_name, t.section AS feed_slug, f.name AS feed_name
    FROM threads t JOIN organizations o ON o.id = t.org_id
    LEFT JOIN org_feeds f ON f.org_id = t.org_id AND f.slug = t.section
    WHERE t.author_id = ${userId}::uuid AND ${visibleThreads(viewer)}
    UNION ALL
    SELECT 'reply', r.id, t.id, t.slug, t.title, ${PLAIN(db`r.content`)}, r.created_at,
           o.slug, o.name, t.section, f.name
    FROM replies r JOIN threads t ON t.id = r.thread_id JOIN organizations o ON o.id = t.org_id
    LEFT JOIN org_feeds f ON f.org_id = t.org_id AND f.slug = t.section
    WHERE r.user_id = ${userId}::uuid AND ${visibleThreads(viewer)}
  `;
  const [rows, [{ total }]] = await Promise.all([
    db<Array<{ kind: 'topic' | 'reply'; id: string; thread_id: string; thread_slug: string; thread_title: string; excerpt: string; at: Date; org_slug: string; org_name: string; feed_slug: string | null; feed_name: string | null }>>`
      SELECT * FROM (${base}) x ${only} ORDER BY at DESC LIMIT ${limit} OFFSET ${offset}`,
    db<Array<{ total: number }>>`SELECT COUNT(*)::int AS total FROM (${base}) x ${only}`,
  ]);
  return {
    rows: rows.map((r) => ({
      kind: r.kind, id: r.id, threadId: r.thread_id, threadSlug: r.thread_slug, threadTitle: r.thread_title,
      excerpt: r.excerpt.trim(), at: r.at, org: { slug: r.org_slug, name: r.org_name },
      feed: { slug: r.feed_slug ?? 'general', name: r.feed_name },
    })),
    page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export type MemberSort = 'active' | 'newest' | 'name';

/** The member directory: listed people, with the board's counts. */
export async function listMembers(opts: { sort?: MemberSort; q?: string; page?: number; limit?: number } = {}): Promise<Paged<ForumPersonCard>> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const page = Math.max(opts.page ?? 1, 1);
  const offset = (page - 1) * limit;
  const q = (opts.q ?? '').trim();
  const where = db`u.slug IS NOT NULL AND u.directory_listed AND u.entity_type = 'person' ${q ? db`AND u.display_name ILIKE ${'%' + q + '%'}` : db``}`;
  const order =
    opts.sort === 'newest' ? db`u.created_at DESC`
    : opts.sort === 'name' ? db`u.display_name ASC`
    : db`(topic_count + reply_count) DESC, u.last_seen_at DESC NULLS LAST, u.display_name ASC`;
  const [rows, [{ total }]] = await Promise.all([
    db<CardRow[]>`SELECT * FROM (SELECT ${CARD_SQL}, u.created_at, u.last_seen_at, u.display_name FROM users u WHERE ${where}) u ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`,
    db<Array<{ total: number }>>`SELECT COUNT(*)::int AS total FROM users u WHERE ${where}`,
  ]);
  return { rows: rows.map(card), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Who's online: listed people seen in the last `minutes`. */
export async function listPresent(minutes = 15, limit = 12): Promise<{ count: number; people: ForumPerson[] }> {
  const where = db`u.slug IS NOT NULL AND u.directory_listed AND u.entity_type = 'person' AND u.last_seen_at > NOW() - (${minutes} || ' minutes')::interval`;
  const [rows, [{ n }]] = await Promise.all([
    db<Array<{ id: string; slug: string | null; name: string; avatar_url: string | null; comment_color: string | null }>>`
      SELECT u.id, u.slug, COALESCE(u.display_name, 'Someone') AS name, u.avatar_url, u.comment_color
      FROM users u WHERE ${where} ORDER BY u.last_seen_at DESC LIMIT ${limit}`,
    db<Array<{ n: number }>>`SELECT COUNT(*)::int AS n FROM users u WHERE ${where}`,
  ]);
  return { count: n, people: rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, avatarUrl: r.avatar_url, commentColor: r.comment_color })) };
}

export async function listNewMembers(limit = 5): Promise<Array<ForumPerson & { joinedAt: Date }>> {
  const rows = await db<Array<{ id: string; slug: string | null; name: string; avatar_url: string | null; comment_color: string | null; created_at: Date }>>`
    SELECT u.id, u.slug, COALESCE(u.display_name, 'Someone') AS name, u.avatar_url, u.comment_color, u.created_at
    FROM users u WHERE u.slug IS NOT NULL AND u.directory_listed AND u.entity_type = 'person'
    ORDER BY u.created_at DESC LIMIT ${limit}`;
  return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, avatarUrl: r.avatar_url, commentColor: r.comment_color, joinedAt: r.created_at }));
}

/**
 * Presence. Nothing else on the network writes last_seen_at, so the forum
 * does — at most once per five minutes per person, from its viewer resolver.
 */
export async function touchLastSeen(userId: string): Promise<void> {
  try {
    await db`UPDATE users SET last_seen_at = NOW() WHERE id = ${userId}::uuid AND (last_seen_at IS NULL OR last_seen_at < NOW() - interval '5 minutes')`;
  } catch (err) {
    console.error('[forum] touchLastSeen:', err);
  }
}

// ── orgs ────────────────────────────────────────────────────────────────────

export interface ForumOrgCard {
  orgId: string;
  slug: string;
  name: string;
  tier: string;
  primaryDomain: string | null;
  identity: { slug: string | null; headline: string | null; avatarUrl: string | null; city: string | null } | null;
  memberCount: number;
  feedCount: number;
  topicCount: number;
  postCount: number;
  lastThread: { id: string; slug: string; title: string; kind: string; lastActivityAt: Date } | null;
}

export async function listOrgCards(viewer: ForumViewer): Promise<ForumOrgCard[]> {
  const rows = await db<Array<{
    id: string; slug: string; name: string; tier: string; primary_domain: string | null;
    i_slug: string | null; i_headline: string | null; i_avatar: string | null; i_city: string | null; has_identity: boolean;
    member_count: number; feed_count: number; topic_count: number; post_count: number;
    lt_id: string | null; lt_slug: string | null; lt_title: string | null; lt_kind: string | null; lt_at: Date | null;
  }>>`
    SELECT o.id, o.slug, o.name, o.tier,
           (SELECT d.domain FROM org_domains d WHERE d.org_id = o.id AND d.is_primary AND d.verified_at IS NOT NULL LIMIT 1) AS primary_domain,
           u.slug AS i_slug, u.headline AS i_headline, u.avatar_url AS i_avatar, u.city AS i_city, (u.id IS NOT NULL) AS has_identity,
           (SELECT COUNT(*)::int FROM user_organizations uo WHERE uo.org_id = o.id) AS member_count,
           (SELECT COUNT(*)::int FROM org_feeds f WHERE f.org_id = o.id AND f.is_public) AS feed_count,
           s.topic_count, s.post_count,
           lt.id AS lt_id, lt.slug AS lt_slug, lt.title AS lt_title, lt.kind AS lt_kind, lt.last_activity_at AS lt_at
    FROM organizations o
    LEFT JOIN users u ON u.id = o.profile_user_id
    CROSS JOIN LATERAL (
      SELECT COUNT(*)::int AS topic_count, (COUNT(*) + COALESCE(SUM(t.reply_count), 0))::int AS post_count
      FROM threads t WHERE t.org_id = o.id AND ${visibleThreads(viewer)}
    ) s
    LEFT JOIN LATERAL (
      SELECT t.id, t.slug, t.title, t.kind, t.last_activity_at FROM threads t
      WHERE t.org_id = o.id AND ${visibleThreads(viewer)} ORDER BY t.last_activity_at DESC NULLS LAST LIMIT 1
    ) lt ON TRUE
    ORDER BY s.topic_count DESC, o.name ASC
  `;
  return rows.map((r) => ({
    orgId: r.id, slug: r.slug, name: r.name, tier: r.tier, primaryDomain: r.primary_domain,
    identity: r.has_identity ? { slug: r.i_slug, headline: r.i_headline, avatarUrl: r.i_avatar, city: r.i_city } : null,
    memberCount: r.member_count, feedCount: r.feed_count, topicCount: r.topic_count, postCount: r.post_count,
    lastThread: r.lt_id ? { id: r.lt_id, slug: r.lt_slug!, title: r.lt_title!, kind: r.lt_kind!, lastActivityAt: r.lt_at! } : null,
  }));
}

// ── taxonomy ────────────────────────────────────────────────────────────────

export interface ForumTopicEntry {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  orgId: string | null;
  count: number;
  proposedBy: ForumPerson | null;
  createdAt: Date;
}

/** The index: approved topics by usage, plus the viewer's own orgs' pending proposals. */
export async function listTopicEntries(viewer: ForumViewer, opts: { includeProposed?: boolean } = {}): Promise<ForumTopicEntry[]> {
  const orgs = Object.keys(viewer.roles);
  const where = opts.includeProposed
    ? db`tp.status <> 'rejected'`
    : db`(tp.status = 'approved' OR (tp.status = 'proposed' AND tp.org_id = ANY(${orgs})))`;
  const rows = await db<Array<{ id: string; slug: string; name: string; description: string | null; status: string; org_id: string | null; count: number; created_at: Date; p_id: string | null; p_slug: string | null; p_name: string | null; p_avatar: string | null; p_color: string | null }>>`
    SELECT tp.id, tp.slug, tp.name, tp.description, tp.status, tp.org_id, tp.created_at,
           (SELECT COUNT(*)::int FROM thread_topics tt JOIN threads t ON t.id = tt.thread_id WHERE tt.topic_id = tp.id AND ${visibleThreads(viewer)}) AS count,
           u.id AS p_id, u.slug AS p_slug, u.display_name AS p_name, u.avatar_url AS p_avatar, u.comment_color AS p_color
    FROM topics tp LEFT JOIN users u ON u.id = tp.proposed_by
    WHERE ${where}
    ORDER BY tp.status ASC, count DESC, tp.name ASC
  `;
  return rows.map((r) => ({
    id: r.id, slug: r.slug, name: r.name, description: r.description, status: r.status, orgId: r.org_id, count: r.count, createdAt: r.created_at,
    proposedBy: r.p_id ? { id: r.p_id, slug: r.p_slug, name: r.p_name ?? 'Someone', avatarUrl: r.p_avatar, commentColor: r.p_color } : null,
  }));
}

export async function getTopicBySlug(slug: string): Promise<ForumTopicEntry | null> {
  const [r] = await db<Array<{ id: string; slug: string; name: string; description: string | null; status: string; org_id: string | null; created_at: Date }>>`
    SELECT id, slug, name, description, status, org_id, created_at FROM topics WHERE slug = ${slug} LIMIT 1`;
  return r ? { id: r.id, slug: r.slug, name: r.name, description: r.description, status: r.status, orgId: r.org_id, count: 0, proposedBy: null, createdAt: r.created_at } : null;
}

/** Approve or reject, and tell the proposer. Admins only. */
export async function reviewTopicAndNotify(viewer: ForumViewer, topicId: string, decision: 'approved' | 'rejected'): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!viewer.isGlobalAdmin) return { ok: false, error: 'Admins only.' };
  const [t] = await db<Array<{ proposed_by: string | null; name: string }>>`
    UPDATE topics SET status = ${decision}, reviewed_at = NOW() WHERE id = ${topicId} RETURNING proposed_by, name`;
  if (!t) return { ok: false, error: 'No such topic.' };
  if (t.proposed_by && t.proposed_by !== viewer.userId) {
    await db`INSERT INTO notifications (id, user_id, kind, actor_id, data) VALUES (${nanoid()}, ${t.proposed_by}, ${decision === 'approved' ? 'topic_approved' : 'topic_rejected'}, ${viewer.userId}, ${db.json({ topicId, name: t.name })})`;
  }
  return { ok: true };
}
