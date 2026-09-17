import { db } from '@elkdonis/db';
import { OFF_FEED_KINDS } from './thread-kinds';
// One list of what "happens at a time" — this file used to spell it out twice.
import { SCHEDULED_KINDS } from './org-calendar';
import { canViewFeed, type OrgFeed } from './org-feeds';

// ============================================================================
// The Grand Forum — read layer.
//
// Every thread in the database is on the forum (settled 2026-09-08).
// `visibility` decides only who sees a row: PUBLIC everyone, ORGANIZATION
// members of that org, INVITE_ONLY the author (invitations aren't modelled
// yet). There is no opt-in and `threads.share_to_network` is ignored.
//
// Two scopes serve two hosts from one set of queries: `network` (apps/forum,
// every org) and `org` (the same package mounted on one org's site). Nothing
// here knows about routes or components — the forum-ui package renders what
// these return, and a host binds them into its connectors.
//
// `vote_score` lands with migration 110; until then `reaction_count` stands
// in for "Top". Recurring threads are listed at their stored `scheduled_at`
// rather than their next occurrence — cycle resolution is the org app's.
// ============================================================================

export type ForumScope = { kind: 'network' } | { kind: 'org'; orgId: string };

export interface ForumViewer {
  userId: string | null;
  /** org_id → role, from user_organizations. Empty when signed out. */
  roles: Record<string, string>;
  isGlobalAdmin?: boolean;
  /**
   * Every identity whose authorship belongs to this person — their own row
   * plus any live pen names (identity_control, migration 132). Omitted means
   * "just userId", which is what every caller predating pen names supplies.
   *
   * This exists because `author_id = viewer.userId` is not only an ownership
   * test in this codebase, it is a VISIBILITY GRANT: it is what lets someone
   * see their own unpublished and org-only threads. Left un-widened, writing
   * under a pen name would hide the result from its own author.
   */
  identityIds?: string[];
}

export const ANONYMOUS: ForumViewer = { userId: null, roles: {} };

/**
 * The viewer's authorship set, for `author_id = ANY(...)`. Falls back to the
 * account's own id, and is empty when signed out — which makes the clause
 * simply false, so no `IS NOT NULL` guard is needed around it.
 */
export function viewerIdentityIds(viewer: ForumViewer): string[] {
  if (viewer.identityIds && viewer.identityIds.length) return viewer.identityIds;
  return viewer.userId ? [viewer.userId] : [];
}

export type ForumSort = 'active' | 'newest' | 'top';

export interface Paged<T> {
  rows: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ForumPerson {
  id: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
  commentColor: string | null;
}

export interface ForumFeedRow {
  orgId: string;
  slug: string;
  name: string;
  tagline: string | null;
  presenter: string | null;
  accent: string | null;
  minRole: OrgFeed['minRole'];
  topicCount: number;
  postCount: number;
  /** Threads with activity the viewer hasn't seen. Null when signed out. */
  unreadCount: number | null;
  lastThread: {
    id: string;
    slug: string;
    title: string;
    kind: string;
    lastActivityAt: Date;
    by: ForumPerson | null;
  } | null;
}

export interface ForumBoard {
  orgId: string;
  slug: string;
  name: string;
  tier: string;
  /** From the org's own users row (migration 099). Null when never linked. */
  identity: {
    slug: string | null;
    headline: string | null;
    avatarUrl: string | null;
    city: string | null;
  } | null;
  feeds: ForumFeedRow[];
}

export interface ForumTopicRow {
  id: string;
  slug: string;
  title: string;
  kind: string;
  excerpt: string | null;
  org: { id: string; slug: string; name: string };
  feed: { slug: string; name: string | null };
  author: ForumPerson;
  pinned: boolean;
  locked: boolean;
  visibility: string;
  replyCount: number;
  viewCount: number;
  /** ups − downs. */
  score: number;
  heartCount: number;
  publishedAt: Date | null;
  lastActivityAt: Date;
  scheduledAt: Date | null;
  lastPoster: ForumPerson | null;
  topics: Array<{ id: string; slug: string; name: string }>;
  /** Activity the viewer hasn't seen. Null when signed out. */
  unread: boolean | null;
}

export interface ForumThreadRecord extends ForumTopicRow {
  bodyHtml: string | null;
  coverImageUrl: string | null;
  durationMinutes: number | null;
  location: string | null;
  isOnline: boolean | null;
  meetingUrl: string | null;
  talkToken: string | null;
  documentUrl: string | null;
  videoLink: string | null;
  recurrencePattern: string | null;
  recurrenceUntil: Date | null;
  isRsvpEnabled: boolean;
  attendeeLimit: number | null;
  rsvpDeadline: Date | null;
  rsvpCount: number;
  viewerAttending: boolean | null;
  viewerWatching: boolean;
  viewerBookmarked: boolean;
  viewerVote: 'up' | 'down' | null;
  viewerHearted: boolean;
  /** Where the viewer last got to; null when signed out or never opened. */
  lastReadAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ForumReply {
  id: string;
  threadId: string;
  parentId: string | null;
  /** 1-based position among top-level replies; null for nested ones. */
  number: number | null;
  author: ForumPerson;
  /** Role in the thread's org, when the author holds one. */
  authorRole: string | null;
  contentHtml: string;
  createdAt: Date;
  editedAt: Date | null;
  heartCount: number;
  score: number;
  viewerVote: 'up' | 'down' | null;
  viewerHearted: boolean;
  /** Direct children, for the "▸ n replies" affordance. */
  childCount: number;
  /** Set on nested replies whose parent is itself nested — the flatten marker. */
  replyingTo: { id: string; name: string } | null;
}

export interface ForumHappeningRow {
  id: string;
  slug: string;
  title: string;
  kind: string;
  scheduledAt: Date;
  durationMinutes: number | null;
  location: string | null;
  isOnline: boolean | null;
  org: { id: string; slug: string; name: string };
  feed: { slug: string; name: string | null };
  rsvpCount: number;
  attendeeLimit: number | null;
}

export interface ForumLatestRow {
  kind: 'reply' | 'thread';
  id: string;
  threadId: string;
  threadSlug: string;
  threadTitle: string;
  by: ForumPerson;
  at: Date;
  org: { slug: string; name: string };
}

export interface ForumPulse {
  orgs: number;
  members: number;
  topics: number;
  posts: number;
  happeningThisWeek: number;
  newest: ForumPerson | null;
}

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Kinds that are threads but never forum topics — a wiki page, a person's own
 * writing. See visibleTo, and OFF_FEED_KINDS in thread-kinds.ts for why an
 * exclusion rather than a visibility.
 */
const notWiki = db`t.kind <> ALL(${OFF_FEED_KINDS})`;

function memberOrgIds(viewer: ForumViewer): string[] {
  return Object.keys(viewer.roles);
}

/**
 * The visibility predicate, as a fragment over alias `t`. Global admins see
 * everything published; everyone else sees PUBLIC, their orgs' ORGANIZATION
 * rows, and their own INVITE_ONLY rows.
 *
 * Wiki pages are excluded for every viewer, admins included. They are threads
 * so they can reuse replies, search and references, but a wiki page is a
 * collectively edited reference surface with no first-post semantics — it is
 * reached through the wiki, never as a forum topic. The own-author and
 * global-admin clauses would otherwise let them through whatever their
 * visibility.
 */
function visibleTo(viewer: ForumViewer) {
  if (viewer.isGlobalAdmin) return db`t.status = 'published' AND ${notWiki}`;
  const orgs = memberOrgIds(viewer);
  const mine = viewerIdentityIds(viewer);
  return db`
    t.status = 'published' AND ${notWiki} AND (
      t.visibility = 'PUBLIC'
      OR (t.visibility = 'ORGANIZATION' AND t.org_id = ANY(${orgs}))
      OR t.author_id = ANY(${mine}::uuid[])
    )
  `;
}

function inScope(scope: ForumScope) {
  return scope.kind === 'org' ? db`AND t.org_id = ${scope.orgId}` : db``;
}

/**
 * The viewer's read state, as a column over alias `t`. Signed-out viewers
 * get NULL, so the row can say "unknown" rather than "read".
 */
function unreadSql(viewer: ForumViewer) {
  const uid = viewer.userId;
  if (!uid) return db`NULL::boolean AS unread`;
  return db`
    (t.last_activity_at > GREATEST(
      COALESCE((SELECT tr.last_read_at FROM thread_reads tr WHERE tr.thread_id = t.id AND tr.user_id = ${uid}::uuid), '-infinity'::timestamptz),
      COALESCE((SELECT uv.forum_read_all_at FROM users uv WHERE uv.id = ${uid}::uuid), '-infinity'::timestamptz)
    )) AS unread`;
}

/** The viewer's own vote and heart on a target, as two columns. */
function viewerReactionSql(viewer: ForumViewer, target: 'thread' | 'reply') {
  const uid = viewer.userId;
  if (!uid) return db`NULL::text AS viewer_vote, FALSE AS viewer_hearted`;
  const where = target === 'thread'
    ? db`rx.thread_id = t.id AND rx.reply_id IS NULL AND rx.user_id = ${uid}::uuid`
    : db`rx.reply_id = r.id AND rx.user_id = ${uid}::uuid`;
  return db`
    (SELECT rx.kind FROM reactions rx WHERE ${where} AND rx.kind IN ('up','down') LIMIT 1) AS viewer_vote,
    EXISTS (SELECT 1 FROM reactions rx WHERE ${where} AND rx.kind = 'like') AS viewer_hearted`;
}

function sortClause(sort: ForumSort) {
  switch (sort) {
    case 'newest':
      return db`COALESCE(t.published_at, t.created_at) DESC`;
    case 'top':
      return db`COALESCE(t.vote_score, 0) DESC, COALESCE(t.reaction_count, 0) DESC, t.last_activity_at DESC`;
    default:
      return db`t.last_activity_at DESC NULLS LAST`;
  }
}

/** HTML → one clipped plain-text line for a topic row. */
const EXCERPT_SQL = db`
  COALESCE(
    NULLIF(t.excerpt, ''),
    LEFT(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(t.body, ''), '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g'), 160)
  )
`;

type PersonRow = {
  p_id: string | null;
  p_slug: string | null;
  p_name: string | null;
  p_avatar: string | null;
  p_color: string | null;
};

function person(r: PersonRow, prefix = 'p_'): ForumPerson | null {
  const g = (k: string) => (r as Record<string, unknown>)[prefix + k] as string | null;
  const id = g('id');
  if (!id) return null;
  return { id, slug: g('slug'), name: g('name') ?? 'Someone', avatarUrl: g('avatar'), commentColor: g('color') };
}

// ── boards ──────────────────────────────────────────────────────────────────

/**
 * Orgs and their feeds with counts and the latest thread — the index table.
 * One query for feeds (lateral stats per feed), one for orgs; grouped here.
 * Feeds the viewer can't read are dropped, not locked.
 */
export async function listBoards(scope: ForumScope, viewer: ForumViewer): Promise<ForumBoard[]> {
  const orgFilter = scope.kind === 'org' ? db`AND o.id = ${scope.orgId}` : db``;

  const orgs = await db<
    Array<{
      id: string; slug: string; name: string; tier: string;
      i_slug: string | null; i_headline: string | null; i_avatar: string | null; i_city: string | null;
      has_identity: boolean;
    }>
  >`
    SELECT o.id, o.slug, o.name, o.tier,
           u.slug AS i_slug, u.headline AS i_headline, u.avatar_url AS i_avatar, u.city AS i_city,
           (u.id IS NOT NULL) AS has_identity
    FROM organizations o
    LEFT JOIN users u ON u.id = o.profile_user_id
    WHERE TRUE ${orgFilter}
    ORDER BY o.name
  `;

  const uid = viewer.userId;
  const feeds = await db<
    Array<{
      org_id: string; slug: string; name: string; tagline: string | null; presenter: string | null;
      accent: string | null; min_role: string | null; sort_order: number;
      topic_count: number; post_count: number; unread_count: number | null;
      lt_id: string | null; lt_slug: string | null; lt_title: string | null; lt_kind: string | null;
      lt_at: Date | null;
    } & PersonRow>
  >`
    SELECT f.org_id, f.slug, f.name, f.tagline, f.presenter, f.accent, f.min_role, f.sort_order,
           s.topic_count, s.post_count, s.unread_count,
           lt.id AS lt_id, lt.slug AS lt_slug, lt.title AS lt_title, lt.kind AS lt_kind,
           lt.last_activity_at AS lt_at,
           u.id AS p_id, u.slug AS p_slug, u.display_name AS p_name, u.avatar_url AS p_avatar,
           u.comment_color AS p_color
    FROM org_feeds f
    CROSS JOIN LATERAL (
      SELECT COUNT(*)::int AS topic_count,
             (COUNT(*) + COALESCE(SUM(t.reply_count), 0))::int AS post_count,
             ${uid ? db`COUNT(*) FILTER (WHERE x.unread)::int` : db`NULL::int`} AS unread_count
      FROM threads t
      CROSS JOIN LATERAL (SELECT ${unreadSql(viewer)}) x
      WHERE t.org_id = f.org_id AND t.section = f.slug AND ${visibleTo(viewer)}
    ) s
    LEFT JOIN LATERAL (
      SELECT t.id, t.slug, t.title, t.kind, t.last_activity_at, t.author_id
      FROM threads t
      WHERE t.org_id = f.org_id AND t.section = f.slug AND ${visibleTo(viewer)}
      ORDER BY t.last_activity_at DESC NULLS LAST
      LIMIT 1
    ) lt ON TRUE
    LEFT JOIN LATERAL (
      -- Whoever posted last in that thread: the latest reply's author, else the thread's.
      SELECT COALESCE(r.user_id, lt.author_id) AS uid
      FROM (SELECT user_id FROM replies WHERE thread_id = lt.id ORDER BY created_at DESC LIMIT 1) r
      RIGHT JOIN (SELECT 1) one ON TRUE
    ) lp ON TRUE
    LEFT JOIN users u ON u.id = lp.uid
    -- Every feed the org has, public or not. The two flags mean different
    -- things and this used to conflate them:
    --   is_public  does it appear in the HOST SITE's navigation
    --   min_role   who may see and enter it  (enforced below, per viewer)
    -- Filtering on is_public here hid whole categories from the forum — IFAC
    -- had 'weekly-meeting' and 'ideas' (both is_public=f, min_role=member)
    -- that members could never reach, leaving 'events' as the only place a
    -- topic could go. min_role is the forum's gate; is_public is the site's.
    -- 'general' (migrations 110/113) is is_public=f for exactly that reason
    -- and no longer needs its special case.
    WHERE TRUE ${scope.kind === 'org' ? db`AND f.org_id = ${scope.orgId}` : db``}
    ORDER BY f.org_id, f.sort_order, f.name
  `;

  const byOrg = new Map<string, ForumFeedRow[]>();
  for (const f of feeds) {
    const role = viewer.roles[f.org_id] ?? null;
    if (!canViewFeed({ minRole: f.min_role as OrgFeed['minRole'] }, role) && !viewer.isGlobalAdmin) continue;
    const row: ForumFeedRow = {
      orgId: f.org_id,
      slug: f.slug,
      name: f.name,
      tagline: f.tagline,
      presenter: f.presenter,
      accent: f.accent,
      minRole: f.min_role as OrgFeed['minRole'],
      topicCount: f.topic_count,
      postCount: f.post_count,
      unreadCount: f.unread_count,
      lastThread: f.lt_id
        ? { id: f.lt_id, slug: f.lt_slug!, title: f.lt_title!, kind: f.lt_kind!, lastActivityAt: f.lt_at!, by: person(f) }
        : null,
    };
    (byOrg.get(f.org_id) ?? byOrg.set(f.org_id, []).get(f.org_id)!).push(row);
  }

  return orgs
    .map((o) => ({
      orgId: o.id,
      slug: o.slug,
      name: o.name,
      tier: o.tier,
      identity: o.has_identity
        ? { slug: o.i_slug, headline: o.i_headline, avatarUrl: o.i_avatar, city: o.i_city }
        : null,
      feeds: byOrg.get(o.id) ?? [],
    }))
    // An org with no readable feeds has no board. On the network host that
    // hides the fifteen placeholder orgs; on an org host it can't happen.
    .filter((b) => b.feeds.length > 0 || scope.kind === 'org');
}

/** One org's board by URL slug, or null. Same shape as a listBoards entry. */
export async function getBoardBySlug(orgSlug: string, viewer: ForumViewer): Promise<ForumBoard | null> {
  const [org] = await db<Array<{ id: string }>>`SELECT id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!org) return null;
  const [board] = await listBoards({ kind: 'org', orgId: org.id }, viewer);
  return board ?? null;
}

export interface ForumTopicIndexRow {
  id: string;
  slug: string;
  name: string;
  count: number;
}

/** The taxonomy, by usage among threads the viewer can see. */
export async function listTopicIndex(viewer: ForumViewer, limit = 50): Promise<ForumTopicIndexRow[]> {
  return db<ForumTopicIndexRow[]>`
    SELECT tp.id, tp.slug, tp.name, COUNT(t.id)::int AS count
    FROM topics tp
    LEFT JOIN thread_topics tt ON tt.topic_id = tp.id
    LEFT JOIN threads t ON t.id = tt.thread_id AND ${visibleTo(viewer)}
    GROUP BY tp.id, tp.slug, tp.name
    ORDER BY count DESC, tp.name ASC
    LIMIT ${limit}
  `;
}

// ── topic lists ─────────────────────────────────────────────────────────────

export type TopicListTarget =
  | { kind: 'network' }
  | { kind: 'org'; orgId: string }
  | { kind: 'feed'; orgId: string; feedSlug: string }
  | { kind: 'topic'; topicId: string }
  /** The three signed-in views. Empty for a signed-out viewer. */
  | { kind: 'unread'; scope: ForumScope }
  | { kind: 'watching'; scope: ForumScope }
  | { kind: 'bookmarks'; scope: ForumScope };

const TOPIC_ROW_SELECT = db`
  t.id, t.slug, t.title, t.kind, t.visibility,
  ${EXCERPT_SQL} AS excerpt,
  t.org_id, o.slug AS org_slug, o.name AS org_name,
  t.section AS feed_slug, f.name AS feed_name,
  COALESCE(t.pinned, false) AS pinned, COALESCE(t.locked, false) AS locked,
  COALESCE(t.reply_count, 0)::int AS reply_count,
  COALESCE(t.view_count, 0)::int AS view_count,
  COALESCE(t.vote_score, 0)::int AS score,
  COALESCE(t.reaction_count, 0)::int AS heart_count,
  t.published_at, t.created_at, COALESCE(t.last_activity_at, t.published_at, t.created_at) AS last_activity_at,
  t.scheduled_at,
  a.id AS a_id, a.slug AS a_slug, a.display_name AS a_name, a.avatar_url AS a_avatar, a.comment_color AS a_color,
  lp.id AS p_id, lp.slug AS p_slug, lp.display_name AS p_name, lp.avatar_url AS p_avatar, lp.comment_color AS p_color,
  COALESCE(tp.topics, '[]'::json) AS topics
`;

const TOPIC_ROW_JOINS = db`
  JOIN organizations o ON o.id = t.org_id
  JOIN users a ON a.id = t.author_id
  LEFT JOIN org_feeds f ON f.org_id = t.org_id AND f.slug = t.section
  LEFT JOIN LATERAL (
    SELECT u.* FROM replies r JOIN users u ON u.id = r.user_id
    WHERE r.thread_id = t.id ORDER BY r.created_at DESC LIMIT 1
  ) lp ON TRUE
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('id', tp.id, 'slug', tp.slug, 'name', tp.name) ORDER BY tp.name) AS topics
    FROM thread_topics tt JOIN topics tp ON tp.id = tt.topic_id WHERE tt.thread_id = t.id
  ) tp ON TRUE
`;

type TopicRowRaw = {
  id: string; slug: string; title: string; kind: string; visibility: string; excerpt: string | null;
  org_id: string; org_slug: string; org_name: string; feed_slug: string | null; feed_name: string | null;
  pinned: boolean; locked: boolean; reply_count: number; view_count: number; score: number; heart_count: number;
  published_at: Date | null; created_at: Date; last_activity_at: Date; scheduled_at: Date | null;
  a_id: string; a_slug: string | null; a_name: string | null; a_avatar: string | null; a_color: string | null;
  topics: Array<{ id: string; slug: string; name: string }>;
  unread: boolean | null;
} & PersonRow;

function topicRow(r: TopicRowRaw): ForumTopicRow {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    kind: r.kind,
    excerpt: r.excerpt?.trim() || null,
    org: { id: r.org_id, slug: r.org_slug, name: r.org_name },
    feed: { slug: r.feed_slug ?? 'general', name: r.feed_name },
    author: person(r, 'a_')!,
    pinned: r.pinned,
    locked: r.locked,
    visibility: r.visibility,
    replyCount: r.reply_count,
    viewCount: r.view_count,
    score: r.score,
    heartCount: r.heart_count,
    publishedAt: r.published_at,
    lastActivityAt: r.last_activity_at,
    scheduledAt: r.scheduled_at,
    lastPoster: person(r),
    topics: r.topics ?? [],
    unread: r.unread,
  };
}

function targetFilter(target: TopicListTarget, viewer: ForumViewer) {
  const uid = viewer.userId;
  switch (target.kind) {
    case 'org':
      return db`AND t.org_id = ${target.orgId}`;
    case 'feed':
      return db`AND t.org_id = ${target.orgId} AND COALESCE(t.section, 'general') = ${target.feedSlug}`;
    case 'topic':
      return db`AND EXISTS (SELECT 1 FROM thread_topics tt WHERE tt.thread_id = t.id AND tt.topic_id = ${target.topicId})`;
    case 'unread':
      if (!uid) return db`AND FALSE`;
      return db`${inScope(target.scope)} AND (SELECT x.unread FROM (SELECT ${unreadSql(viewer)}) x)`;
    case 'watching':
      if (!uid) return db`AND FALSE`;
      return db`${inScope(target.scope)} AND EXISTS (SELECT 1 FROM watches w WHERE w.thread_id = t.id AND w.user_id = ${uid}::uuid)`;
    case 'bookmarks':
      if (!uid) return db`AND FALSE`;
      return db`${inScope(target.scope)} AND EXISTS (SELECT 1 FROM bookmarks b WHERE b.thread_id = t.id AND b.reply_id IS NULL AND b.user_id = ${uid}::uuid)`;
    default:
      return db``;
  }
}

export async function listTopics(
  target: TopicListTarget,
  viewer: ForumViewer,
  opts: { sort?: ForumSort; page?: number; limit?: number } = {}
): Promise<Paged<ForumTopicRow>> {
  const sort = opts.sort ?? 'active';
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);
  const offset = (page - 1) * limit;

  const [rows, [{ total }]] = await Promise.all([
    db<TopicRowRaw[]>`
      SELECT ${TOPIC_ROW_SELECT}, ${unreadSql(viewer)}
      FROM threads t
      ${TOPIC_ROW_JOINS}
      WHERE ${visibleTo(viewer)} ${targetFilter(target, viewer)}
      ORDER BY COALESCE(t.pinned, false) DESC, ${sortClause(sort)}
      LIMIT ${limit} OFFSET ${offset}
    `,
    db<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS total FROM threads t
      WHERE ${visibleTo(viewer)} ${targetFilter(target, viewer)}
    `,
  ]);

  return {
    rows: rows.map(topicRow),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ── one thread ──────────────────────────────────────────────────────────────

export async function getForumThread(id: string, viewer: ForumViewer): Promise<ForumThreadRecord | null> {
  const uid = viewer.userId;
  const rows = await db<
    Array<
      TopicRowRaw & {
        body: string | null; cover_image_url: string | null; duration_minutes: number | null;
        location: string | null; is_online: boolean | null; meeting_url: string | null;
        nextcloud_talk_token: string | null; document_url: string | null; video_link: string | null;
        recurrence_pattern: string | null; recurrence_until: Date | null; is_rsvp_enabled: boolean;
        attendee_limit: number | null; rsvp_deadline: Date | null; rsvp_count: number;
        viewer_attending: boolean | null; viewer_watching: boolean; viewer_bookmarked: boolean;
        viewer_vote: 'up' | 'down' | null; viewer_hearted: boolean; last_read_at: Date | null;
        updated_at: Date;
      }
    >
  >`
    SELECT ${TOPIC_ROW_SELECT}, ${unreadSql(viewer)}, ${viewerReactionSql(viewer, 'thread')},
           ${uid ? db`(SELECT tr.last_read_at FROM thread_reads tr WHERE tr.thread_id = t.id AND tr.user_id = ${uid}::uuid)` : db`NULL::timestamptz`} AS last_read_at,
           t.body, t.metadata->>'coverImageUrl' AS cover_image_url,
           t.duration_minutes, t.location, t.is_online, t.meeting_url, t.nextcloud_talk_token,
           t.document_url, t.video_link, t.recurrence_pattern, t.recurrence_until,
           COALESCE(t.is_rsvp_enabled, false) AS is_rsvp_enabled, t.attendee_limit, t.rsvp_deadline,
           t.updated_at,
           (SELECT COUNT(*)::int FROM thread_rsvps rs WHERE rs.thread_id = t.id AND rs.status = 'yes') AS rsvp_count,
           CASE WHEN ${uid}::uuid IS NULL THEN NULL
                ELSE EXISTS (SELECT 1 FROM thread_rsvps rs WHERE rs.thread_id = t.id AND rs.user_id = ${uid}::uuid AND rs.status = 'yes')
           END AS viewer_attending,
           (${uid}::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM watches w WHERE w.thread_id = t.id AND w.user_id = ${uid}::uuid)) AS viewer_watching,
           (${uid}::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM bookmarks b WHERE b.thread_id = t.id AND b.user_id = ${uid}::uuid AND b.reply_id IS NULL)) AS viewer_bookmarked
    FROM threads t
    ${TOPIC_ROW_JOINS}
    WHERE t.id = ${id} AND ${visibleTo(viewer)}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    ...topicRow(r),
    bodyHtml: r.body,
    coverImageUrl: r.cover_image_url,
    durationMinutes: r.duration_minutes,
    location: r.location,
    isOnline: r.is_online,
    meetingUrl: r.meeting_url,
    talkToken: r.nextcloud_talk_token,
    documentUrl: r.document_url,
    videoLink: r.video_link,
    recurrencePattern: r.recurrence_pattern,
    recurrenceUntil: r.recurrence_until,
    isRsvpEnabled: r.is_rsvp_enabled,
    attendeeLimit: r.attendee_limit,
    rsvpDeadline: r.rsvp_deadline,
    rsvpCount: r.rsvp_count,
    viewerAttending: r.viewer_attending,
    viewerWatching: r.viewer_watching,
    viewerBookmarked: r.viewer_bookmarked,
    viewerVote: r.viewer_vote,
    viewerHearted: r.viewer_hearted,
    lastReadAt: r.last_read_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Bump view_count. Fire-and-forget from a page render. */
export async function recordThreadView(id: string): Promise<void> {
  try {
    await db`UPDATE threads SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ${id}`;
  } catch (err) {
    console.error('[forum] recordThreadView:', err);
  }
}

// ── replies ─────────────────────────────────────────────────────────────────

type ReplyRaw = {
  id: string; thread_id: string; parent_reply_id: string | null; content: string;
  created_at: Date; edited_at: Date | null; heart_count: number; score: number; child_count: number;
  number: number | null; author_role: string | null;
  rt_id: string | null; rt_name: string | null;
  viewer_vote: 'up' | 'down' | null; viewer_hearted: boolean;
} & PersonRow;

function replyRow(r: ReplyRaw): ForumReply {
  return {
    id: r.id,
    threadId: r.thread_id,
    parentId: r.parent_reply_id,
    number: r.number,
    author: person(r)!,
    authorRole: r.author_role,
    contentHtml: r.content,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    heartCount: r.heart_count,
    score: r.score,
    viewerVote: r.viewer_vote,
    viewerHearted: r.viewer_hearted,
    childCount: r.child_count,
    replyingTo: r.rt_id ? { id: r.rt_id, name: r.rt_name ?? 'Someone' } : null,
  };
}

/**
 * Top-level replies, chronological, paged. Each carries its direct child
 * count so the stream can offer "▸ n replies" without a second query.
 * `number` is the 1-based position in the whole top-level sequence — the
 * classic `#n` — so it survives paging.
 */
export async function listReplies(
  threadId: string,
  opts: { page?: number; limit?: number; viewer?: ForumViewer } = {}
): Promise<Paged<ForumReply>> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);
  const offset = (page - 1) * limit;
  const viewer = opts.viewer ?? ANONYMOUS;

  const [rows, [{ total }]] = await Promise.all([
    db<ReplyRaw[]>`
      WITH top AS (
        SELECT r.*, ROW_NUMBER() OVER (ORDER BY r.created_at ASC, r.id) AS number
        FROM replies r WHERE r.thread_id = ${threadId} AND r.parent_reply_id IS NULL
      )
      SELECT r.id, r.thread_id, r.parent_reply_id, r.content, r.created_at, r.edited_at,
             COALESCE(r.reaction_count, 0)::int AS heart_count, COALESCE(r.vote_score, 0)::int AS score, r.number::int AS number,
             (SELECT COUNT(*)::int FROM replies c WHERE c.parent_reply_id = r.id) AS child_count,
             uo.role AS author_role,
             NULL::varchar AS rt_id, NULL::varchar AS rt_name,
             ${viewerReactionSql(viewer, 'reply')},
             u.id AS p_id, u.slug AS p_slug, u.display_name AS p_name, u.avatar_url AS p_avatar, u.comment_color AS p_color
      FROM top r
      JOIN users u ON u.id = r.user_id
      JOIN threads t ON t.id = r.thread_id
      LEFT JOIN user_organizations uo ON uo.user_id = u.id AND uo.org_id = t.org_id
      ORDER BY r.number
      LIMIT ${limit} OFFSET ${offset}
    `,
    db<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS total FROM replies WHERE thread_id = ${threadId} AND parent_reply_id IS NULL
    `,
  ]);

  return { rows: rows.map(replyRow), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/**
 * Everything beneath one top-level reply, flattened to a single
 * chronological list. A reply whose parent is not `parentId` gets
 * `replyingTo` — the "↳ replying to @name" marker of the one-level layout.
 */
export async function listReplyChildren(parentId: string, viewer: ForumViewer = ANONYMOUS): Promise<ForumReply[]> {
  const rows = await db<ReplyRaw[]>`
    WITH RECURSIVE sub AS (
      SELECT r.* FROM replies r WHERE r.parent_reply_id = ${parentId}
      UNION ALL
      SELECT r.* FROM replies r JOIN sub ON r.parent_reply_id = sub.id
    )
    SELECT r.id, r.thread_id, r.parent_reply_id, r.content, r.created_at, r.edited_at,
           COALESCE(r.reaction_count, 0)::int AS heart_count, COALESCE(r.vote_score, 0)::int AS score, NULL::int AS number,
           0 AS child_count,
           uo.role AS author_role,
           CASE WHEN r.parent_reply_id <> ${parentId} THEN pr.id END AS rt_id,
           CASE WHEN r.parent_reply_id <> ${parentId} THEN pu.display_name END AS rt_name,
           ${viewerReactionSql(viewer, 'reply')},
           u.id AS p_id, u.slug AS p_slug, u.display_name AS p_name, u.avatar_url AS p_avatar, u.comment_color AS p_color
    FROM sub r
    JOIN users u ON u.id = r.user_id
    JOIN threads t ON t.id = r.thread_id
    LEFT JOIN user_organizations uo ON uo.user_id = u.id AND uo.org_id = t.org_id
    LEFT JOIN replies pr ON pr.id = r.parent_reply_id
    LEFT JOIN users pu ON pu.id = pr.user_id
    ORDER BY r.created_at ASC, r.id
  `;
  return rows.map(replyRow);
}

// ── network furniture ───────────────────────────────────────────────────────

export async function listHappening(
  scope: ForumScope,
  viewer: ForumViewer,
  opts: { limit?: number; days?: number } = {}
): Promise<ForumHappeningRow[]> {
  const limit = Math.min(opts.limit ?? 5, 50);
  const horizon = opts.days ? db`AND t.scheduled_at < NOW() + (${opts.days} || ' days')::interval` : db``;
  const rows = await db<
    Array<{
      id: string; slug: string; title: string; kind: string; scheduled_at: Date; duration_minutes: number | null;
      location: string | null; is_online: boolean | null; org_id: string; org_slug: string; org_name: string;
      feed_slug: string | null; feed_name: string | null; rsvp_count: number; attendee_limit: number | null;
    }>
  >`
    SELECT t.id, t.slug, t.title, t.kind, t.scheduled_at, t.duration_minutes, t.location, t.is_online,
           t.org_id, o.slug AS org_slug, o.name AS org_name, t.section AS feed_slug, f.name AS feed_name,
           (SELECT COUNT(*)::int FROM thread_rsvps rs WHERE rs.thread_id = t.id AND rs.status = 'yes') AS rsvp_count,
           t.attendee_limit
    FROM threads t
    JOIN organizations o ON o.id = t.org_id
    LEFT JOIN org_feeds f ON f.org_id = t.org_id AND f.slug = t.section
    WHERE ${visibleTo(viewer)} ${inScope(scope)}
      AND t.kind = ANY(${SCHEDULED_KINDS as unknown as string[]})
      AND t.scheduled_at >= NOW() ${horizon}
    ORDER BY t.scheduled_at ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id, slug: r.slug, title: r.title, kind: r.kind, scheduledAt: r.scheduled_at,
    durationMinutes: r.duration_minutes, location: r.location, isOnline: r.is_online,
    org: { id: r.org_id, slug: r.org_slug, name: r.org_name },
    feed: { slug: r.feed_slug ?? 'general', name: r.feed_name },
    rsvpCount: r.rsvp_count, attendeeLimit: r.attendee_limit,
  }));
}

/** Replies ∪ new threads, newest first — the "latest posts" rail. */
export async function listLatest(
  scope: ForumScope,
  viewer: ForumViewer,
  opts: { limit?: number } = {}
): Promise<ForumLatestRow[]> {
  const limit = Math.min(opts.limit ?? 8, 50);
  const rows = await db<
    Array<{
      kind: 'reply' | 'thread'; id: string; thread_id: string; thread_slug: string; thread_title: string;
      at: Date; org_slug: string; org_name: string;
    } & PersonRow>
  >`
    SELECT * FROM (
      SELECT 'reply'::text AS kind, r.id, t.id AS thread_id, t.slug AS thread_slug, t.title AS thread_title,
             r.created_at AS at, o.slug AS org_slug, o.name AS org_name,
             u.id AS p_id, u.slug AS p_slug, u.display_name AS p_name, u.avatar_url AS p_avatar, u.comment_color AS p_color
      FROM replies r
      JOIN threads t ON t.id = r.thread_id
      JOIN organizations o ON o.id = t.org_id
      JOIN users u ON u.id = r.user_id
      WHERE ${visibleTo(viewer)} ${inScope(scope)}
      UNION ALL
      SELECT 'thread', t.id, t.id, t.slug, t.title,
             COALESCE(t.published_at, t.created_at), o.slug, o.name,
             u.id, u.slug, u.display_name, u.avatar_url, u.comment_color
      FROM threads t
      JOIN organizations o ON o.id = t.org_id
      JOIN users u ON u.id = t.author_id
      WHERE ${visibleTo(viewer)} ${inScope(scope)}
    ) x
    ORDER BY at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    kind: r.kind, id: r.id, threadId: r.thread_id, threadSlug: r.thread_slug, threadTitle: r.thread_title,
    by: person(r)!, at: r.at, org: { slug: r.org_slug, name: r.org_name },
  }));
}

/** The statistics strip. Counts are per viewer, like everything else. */
export async function getPulse(viewer: ForumViewer): Promise<ForumPulse> {
  const [[c], newest] = await Promise.all([
    db<Array<{ orgs: number; members: number; topics: number; posts: number; happening: number }>>`
      SELECT
        (SELECT COUNT(DISTINCT t.org_id)::int FROM threads t WHERE ${visibleTo(viewer)}) AS orgs,
        (SELECT COUNT(*)::int FROM users WHERE slug IS NOT NULL AND directory_listed) AS members,
        (SELECT COUNT(*)::int FROM threads t WHERE ${visibleTo(viewer)}) AS topics,
        (SELECT COUNT(*)::int + COALESCE(SUM(t.reply_count), 0)::int FROM threads t WHERE ${visibleTo(viewer)}) AS posts,
        (SELECT COUNT(*)::int FROM threads t
          WHERE ${visibleTo(viewer)} AND t.kind = ANY(${SCHEDULED_KINDS as unknown as string[]})
            AND t.scheduled_at >= NOW() AND t.scheduled_at < NOW() + interval '7 days') AS happening
    `,
    db<PersonRow[]>`
      SELECT u.id AS p_id, u.slug AS p_slug, u.display_name AS p_name, u.avatar_url AS p_avatar, u.comment_color AS p_color
      FROM users u WHERE u.slug IS NOT NULL AND u.directory_listed
      ORDER BY u.created_at DESC LIMIT 1
    `,
  ]);
  return {
    orgs: c.orgs, members: c.members, topics: c.topics, posts: c.posts,
    happeningThisWeek: c.happening, newest: newest[0] ? person(newest[0]) : null,
  };
}

/**
 * The first top-level reply the viewer hasn't seen (it, or something under
 * it, is newer than their read mark), with the page it sits on. Null when
 * there's nothing new or the viewer is signed out.
 */
export async function firstUnreadReply(
  threadId: string,
  viewer: ForumViewer,
  perPage = 20
): Promise<{ replyId: string; page: number } | null> {
  const uid = viewer.userId;
  if (!uid) return null;
  const [row] = await db<Array<{ id: string; n: number }>>`
    WITH mark AS (
      SELECT GREATEST(
        COALESCE((SELECT last_read_at FROM thread_reads WHERE thread_id = ${threadId} AND user_id = ${uid}::uuid), '-infinity'::timestamptz),
        COALESCE((SELECT forum_read_all_at FROM users WHERE id = ${uid}::uuid), '-infinity'::timestamptz)
      ) AS since
    ),
    top AS (
      SELECT r.id, r.created_at, ROW_NUMBER() OVER (ORDER BY r.created_at ASC, r.id) AS n
      FROM replies r WHERE r.thread_id = ${threadId} AND r.parent_reply_id IS NULL
    )
    SELECT top.id, top.n::int AS n
    FROM top, mark
    WHERE top.created_at > mark.since
       OR EXISTS (SELECT 1 FROM replies c WHERE c.parent_reply_id = top.id AND c.created_at > mark.since)
    ORDER BY top.n ASC
    LIMIT 1
  `;
  if (!row) return null;
  return { replyId: row.id, page: Math.max(1, Math.ceil(row.n / perPage)) };
}

/** The viewer's org roles, for building a ForumViewer from a session. */
export async function getViewerRoles(userId: string): Promise<Record<string, string>> {
  const rows = await db<Array<{ org_id: string; role: string }>>`
    SELECT org_id, role FROM user_organizations WHERE user_id = ${userId}
  `;
  return Object.fromEntries(rows.map((r) => [r.org_id, r.role]));
}
