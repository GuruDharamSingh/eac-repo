import { db } from '@elkdonis/db';
import { OFF_FEED_KINDS } from './thread-kinds';
import { viewerIdentityIds } from './forum';
import type { ForumPerson, ForumScope, ForumViewer, Paged } from './forum';

// ============================================================================
// The Grand Forum — search and the moderation log (phase 5).
//
// Postgres full-text over the generated tsvectors from migration 114, with
// the same per-viewer visibility rule as every other read: a search never
// surfaces a row the viewer could not otherwise open.
// ============================================================================

export interface ForumSearchHit {
  kind: 'thread' | 'reply';
  /** The reply's id when kind is reply — for the #anchor. */
  id: string;
  threadId: string;
  threadSlug: string;
  threadTitle: string;
  /** The title with matches wrapped in <mark> — the whole title, always. */
  titleHtml: string;
  /** Highlighted fragment, containing <mark> and nothing else. */
  snippet: string;
  at: Date;
  author: ForumPerson;
  org: { slug: string; name: string };
  feed: { slug: string; name: string | null };
  rank: number;
}

/** Wiki pages are excluded for every viewer — they are not forum topics. */
function visible(viewer: ForumViewer) {
  if (viewer.isGlobalAdmin) return db`t.status = 'published' AND t.kind <> ALL(${OFF_FEED_KINDS})`;
  const orgs = Object.keys(viewer.roles);
  const mine = viewerIdentityIds(viewer);
  return db`
    t.status = 'published' AND t.kind <> ALL(${OFF_FEED_KINDS}) AND (
      t.visibility = 'PUBLIC'
      OR (t.visibility = 'ORGANIZATION' AND t.org_id = ANY(${orgs}))
      OR t.author_id = ANY(${mine}::uuid[])
    )`;
}

const HEADLINE_OPTS = 'StartSel=<mark>,StopSel=</mark>,MaxWords=32,MinWords=12,MaxFragments=1,FragmentDelimiter= … ';
/** HighlightAll returns the whole field, so a title comes back intact with its matches marked. */
const TITLE_OPTS = 'StartSel=<mark>,StopSel=</mark>,HighlightAll=true';

/**
 * Search topics and replies.
 *
 * `websearch_to_tsquery` takes what a person actually types — quoted
 * phrases, `or`, a leading `-` to exclude — and never throws on syntax,
 * which plain `to_tsquery` does. Titles are also matched by trigram
 * similarity, so a near-miss spelling still finds the topic.
 */
export async function searchForum(
  q: string,
  viewer: ForumViewer,
  opts: { scope?: ForumScope; page?: number; limit?: number; only?: 'thread' | 'reply' } = {}
): Promise<Paged<ForumSearchHit>> {
  const query = (q ?? '').trim();
  const limit = Math.min(opts.limit ?? 25, 100);
  const page = Math.max(opts.page ?? 1, 1);
  const offset = (page - 1) * limit;
  if (query.length < 2) return { rows: [], page, limit, total: 0, totalPages: 1 };

  const scope = opts.scope;
  const inScope = scope?.kind === 'org' ? db`AND t.org_id = ${scope.orgId}` : db``;
  const threadsOnly = opts.only === 'reply' ? db`AND FALSE` : db``;
  const repliesOnly = opts.only === 'thread' ? db`AND FALSE` : db``;

  const base = db`
    SELECT 'thread'::text AS kind, t.id, t.id AS thread_id, t.slug AS thread_slug, t.title AS thread_title,
           ts_headline('english', t.title, websearch_to_tsquery('english', ${query}), ${TITLE_OPTS}) AS title_html,
           ts_headline('english', COALESCE(NULLIF(t.excerpt, ''), REGEXP_REPLACE(COALESCE(t.body, ''), '<[^>]*>', ' ', 'g'), t.title),
                       websearch_to_tsquery('english', ${query}), ${HEADLINE_OPTS}) AS snippet,
           COALESCE(t.published_at, t.created_at) AS at,
           GREATEST(ts_rank(t.search_tsv, websearch_to_tsquery('english', ${query})), similarity(t.title, ${query})) AS rank,
           a.id AS p_id, a.slug AS p_slug, COALESCE(a.display_name, 'Someone') AS p_name, a.avatar_url AS p_avatar, a.comment_color AS p_color,
           o.slug AS org_slug, o.name AS org_name, t.section AS feed_slug, f.name AS feed_name
    FROM threads t
    JOIN users a ON a.id = t.author_id
    JOIN organizations o ON o.id = t.org_id
    LEFT JOIN org_feeds f ON f.org_id = t.org_id AND f.slug = t.section
    WHERE ${visible(viewer)} ${inScope} ${threadsOnly}
      AND (t.search_tsv @@ websearch_to_tsquery('english', ${query}) OR t.title % ${query})
    UNION ALL
    SELECT 'reply', r.id, t.id, t.slug, t.title,
           ts_headline('english', t.title, websearch_to_tsquery('english', ${query}), ${TITLE_OPTS}),
           ts_headline('english', REGEXP_REPLACE(r.content, '<[^>]*>', ' ', 'g'),
                       websearch_to_tsquery('english', ${query}), ${HEADLINE_OPTS}),
           r.created_at,
           ts_rank(r.search_tsv, websearch_to_tsquery('english', ${query})),
           u.id, u.slug, COALESCE(u.display_name, 'Someone'), u.avatar_url, u.comment_color,
           o.slug, o.name, t.section, f.name
    FROM replies r
    JOIN threads t ON t.id = r.thread_id
    JOIN users u ON u.id = r.user_id
    JOIN organizations o ON o.id = t.org_id
    LEFT JOIN org_feeds f ON f.org_id = t.org_id AND f.slug = t.section
    WHERE ${visible(viewer)} ${inScope} ${repliesOnly}
      AND r.search_tsv @@ websearch_to_tsquery('english', ${query})
  `;

  const [rows, [{ total }]] = await Promise.all([
    db<Array<{
      kind: 'thread' | 'reply'; id: string; thread_id: string; thread_slug: string; thread_title: string;
      title_html: string; snippet: string; at: Date; rank: number; p_id: string; p_slug: string | null; p_name: string;
      p_avatar: string | null; p_color: string | null; org_slug: string; org_name: string;
      feed_slug: string | null; feed_name: string | null;
    }>>`SELECT * FROM (${base}) x ORDER BY rank DESC, at DESC LIMIT ${limit} OFFSET ${offset}`,
    db<Array<{ total: number }>>`SELECT COUNT(*)::int AS total FROM (${base}) x`,
  ]);

  return {
    rows: rows.map((r) => ({
      kind: r.kind, id: r.id, threadId: r.thread_id, threadSlug: r.thread_slug, threadTitle: r.thread_title,
      titleHtml: r.title_html, snippet: r.snippet, at: r.at, rank: r.rank,
      author: { id: r.p_id, slug: r.p_slug, name: r.p_name, avatarUrl: r.p_avatar, commentColor: r.p_color },
      org: { slug: r.org_slug, name: r.org_name },
      feed: { slug: r.feed_slug ?? 'general', name: r.feed_name },
    })),
    page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ── moderation log ──────────────────────────────────────────────────────────

export interface ForumModLogEntry {
  id: string;
  action: string;
  at: Date;
  actor: ForumPerson | null;
  thread: { id: string; slug: string; title: string } | null;
  data: Record<string, unknown>;
}

const FORUM_MOD_ACTIONS = ['content_pinned', 'content_unpinned', 'content_locked', 'content_unlocked', 'content_hidden', 'content_unhidden', 'post_updated'];

/**
 * What moderators did, newest first. Readable by that org's owners and
 * guides; a moderation log the members can't see is a rumour mill.
 */
export async function listModLog(orgId: string, opts: { limit?: number; page?: number } = {}): Promise<Paged<ForumModLogEntry>> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const page = Math.max(opts.page ?? 1, 1);
  const offset = (page - 1) * limit;
  const where = db`e.org_id = ${orgId} AND e.action = ANY(${FORUM_MOD_ACTIONS}) AND e.data->>'via' = 'forum'`;
  const [rows, [{ total }]] = await Promise.all([
    db<Array<{ id: string; action: string; created_at: Date; data: Record<string, unknown>; t_id: string | null; t_slug: string | null; t_title: string | null; p_id: string | null; p_slug: string | null; p_name: string | null; p_avatar: string | null; p_color: string | null }>>`
      SELECT e.id, e.action, e.created_at, e.data,
             t.id AS t_id, t.slug AS t_slug, t.title AS t_title,
             u.id AS p_id, u.slug AS p_slug, u.display_name AS p_name, u.avatar_url AS p_avatar, u.comment_color AS p_color
      FROM events e
      LEFT JOIN threads t ON t.id = e.resource_id
      LEFT JOIN users u ON u.id = e.user_id
      WHERE ${where}
      ORDER BY e.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    db<Array<{ total: number }>>`SELECT COUNT(*)::int AS total FROM events e WHERE ${where}`,
  ]);
  return {
    rows: rows.map((r) => ({
      id: r.id, action: r.action, at: r.created_at, data: r.data ?? {},
      thread: r.t_id ? { id: r.t_id, slug: r.t_slug!, title: r.t_title! } : null,
      actor: r.p_id ? { id: r.p_id, slug: r.p_slug, name: r.p_name ?? 'Someone', avatarUrl: r.p_avatar, commentColor: r.p_color } : null,
    })),
    page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
