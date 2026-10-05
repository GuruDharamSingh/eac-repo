import { db } from '@elkdonis/db';
import { RANGES, type RangeKey, type SourceKind } from './index';

// ---------------------------------------------------------------------------
// Author insights: what happened to one person's own posts. Visible only to
// that person (the host page passes the session's authorship ids). Views come from
// analytics_events rows credited to a thread, which the collector records only
// for public, published threads; replies, reactions and bookmarks come from the
// forum tables for every post. Readers are counted, never named.
// ---------------------------------------------------------------------------

export interface PostInsight {
  threadId: string;
  orgId: string;
  orgName: string | null;
  title: string;
  slug: string;
  kind: string;
  visibility: string;
  publishedAt: string | null;
  /** Views in range (public threads only; 0 for a non-public post). */
  views: number;
  visitors: number;
  avgDurationSec: number;
  /** Most common way visits to this post began, in range. */
  topSource: { kind: SourceKind; host: string | null } | null;
  /** From others, in range / all time. */
  repliesInRange: number;
  repliesTotal: number;
  reactionsInRange: number;
  reactionsTotal: number;
  bookmarksTotal: number;
  lastActivityAt: string | null;
}

export interface ActivityItem {
  at: string;
  type: 'reply' | 'reaction' | 'bookmark';
  who: string;
  threadId: string;
  threadTitle: string;
  /** Start of the reply; reaction kind for a reaction. */
  text: string | null;
}

export interface AuthorInsights {
  range: RangeKey;
  from: string;
  to: string;
  totals: { posts: number; views: number; visitors: number; replies: number; reactions: number; bookmarks: number; signedInReaders: number };
  daily: Array<{ day: string; views: number }>;
  sources: Array<{ kind: SourceKind; referrerHost: string | null; visits: number }>;
  posts: PostInsight[];
  activity: ActivityItem[];
}

const n = (v: unknown) => Number(v ?? 0);
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export async function getAuthorInsights(opts: {
  /** The person's authorship set: their user id plus any pen-name identities. */
  authorIds: string[];
  range: RangeKey;
  /** Limit to one org's posts (an org-scoped forum). */
  orgId?: string | null;
  timeZone?: string;
}): Promise<AuthorInsights> {
  const ids = opts.authorIds;
  const days = RANGES.find((r) => r.key === opts.range)?.days ?? 30;
  const tz = opts.timeZone ?? 'UTC';
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const org = opts.orgId ?? null;
  const orgOnly = org ? db`AND t.org_id = ${org}` : db``;
  const mine = db`e.thread_id IN (SELECT t.id FROM threads t WHERE t.author_id = ANY(${ids}::uuid[]) ${orgOnly})`;

  const [posts, totals, daily, sources, activity] = await Promise.all([
    db<Array<Record<string, unknown>>>`
      WITH my AS (
        SELECT t.id, t.org_id, t.title, t.slug, t.kind, t.visibility, t.published_at, t.last_activity_at
        FROM threads t
        WHERE t.author_id = ANY(${ids}::uuid[]) AND t.status = 'published' ${orgOnly}
        ORDER BY COALESCE(t.last_activity_at, t.published_at, t.created_at) DESC LIMIT 60
      ), v AS (
        SELECT e.thread_id, count(*) AS views, count(DISTINCT e.visitor_id) AS visitors,
               COALESCE(avg(e.duration_ms), 0) / 1000.0 AS avg_dur
        FROM analytics_events e
        WHERE e.kind = 'pageview' AND e.thread_id IN (SELECT id FROM my)
          AND e.occurred_at >= ${from} AND e.occurred_at < ${to}
        GROUP BY e.thread_id
      ), src AS (
        SELECT DISTINCT ON (thread_id) thread_id, source_kind, referrer_host FROM (
          SELECT e.thread_id, e.source_kind, e.referrer_host, count(*) AS c
          FROM analytics_events e
          WHERE e.kind = 'pageview' AND e.is_entry AND e.thread_id IN (SELECT id FROM my)
            AND e.occurred_at >= ${from} AND e.occurred_at < ${to}
          GROUP BY 1, 2, 3
        ) s ORDER BY thread_id, c DESC
      ), r AS (
        SELECT thread_id, count(*) AS total, count(*) FILTER (WHERE created_at >= ${from}) AS inrange
        FROM replies WHERE thread_id IN (SELECT id FROM my) AND user_id <> ALL(${ids}::uuid[]) GROUP BY thread_id
      ), x AS (
        SELECT thread_id, count(*) AS total, count(*) FILTER (WHERE created_at >= ${from}) AS inrange
        FROM reactions WHERE thread_id IN (SELECT id FROM my) AND reply_id IS NULL AND user_id <> ALL(${ids}::uuid[]) GROUP BY thread_id
      ), b AS (
        SELECT thread_id, count(*) AS total FROM bookmarks
        WHERE thread_id IN (SELECT id FROM my) AND reply_id IS NULL AND user_id <> ALL(${ids}::uuid[]) GROUP BY thread_id
      )
      SELECT my.*, o.name AS org_name,
             COALESCE(v.views, 0) AS views, COALESCE(v.visitors, 0) AS visitors, COALESCE(v.avg_dur, 0) AS avg_dur,
             src.source_kind, src.referrer_host,
             COALESCE(r.inrange, 0) AS r_in, COALESCE(r.total, 0) AS r_tot,
             COALESCE(x.inrange, 0) AS x_in, COALESCE(x.total, 0) AS x_tot,
             COALESCE(b.total, 0) AS b_tot
      FROM my LEFT JOIN organizations o ON o.id = my.org_id
        LEFT JOIN v ON v.thread_id = my.id LEFT JOIN src ON src.thread_id = my.id
        LEFT JOIN r ON r.thread_id = my.id LEFT JOIN x ON x.thread_id = my.id LEFT JOIN b ON b.thread_id = my.id
      ORDER BY COALESCE(v.views, 0) DESC, COALESCE(r.inrange, 0) DESC, my.published_at DESC NULLS LAST`,
    db<Array<Record<string, unknown>>>`
      SELECT count(*) FILTER (WHERE e.kind = 'pageview') AS views,
             count(DISTINCT e.visitor_id) FILTER (WHERE e.kind = 'pageview') AS visitors,
             count(DISTINCT e.user_id) FILTER (WHERE e.user_id IS NOT NULL AND e.user_id <> ALL(${ids}::uuid[])) AS readers
      FROM analytics_events e
      WHERE ${mine} AND e.occurred_at >= ${from} AND e.occurred_at < ${to}`,
    db<Array<Record<string, unknown>>>`
      SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(x.c, 0) AS c
      FROM generate_series(date_trunc('day', ${from}::timestamptz AT TIME ZONE ${tz}),
                           date_trunc('day', ${to}::timestamptz AT TIME ZONE ${tz}), INTERVAL '1 day') d
      LEFT JOIN (
        SELECT date_trunc('day', e.occurred_at AT TIME ZONE ${tz}) AS day, count(*) AS c
        FROM analytics_events e
        WHERE e.kind = 'pageview' AND ${mine} AND e.occurred_at >= ${from} AND e.occurred_at < ${to} GROUP BY 1
      ) x ON x.day = d ORDER BY d`,
    db<Array<Record<string, unknown>>>`
      SELECT e.source_kind AS kind, e.referrer_host AS host, count(*) AS c
      FROM analytics_events e
      WHERE e.kind = 'pageview' AND e.is_entry AND ${mine} AND e.occurred_at >= ${from} AND e.occurred_at < ${to}
      GROUP BY 1, 2 ORDER BY c DESC LIMIT 10`,
    db<Array<Record<string, unknown>>>`
      SELECT * FROM (
        SELECT r.created_at AS at, 'reply' AS type, COALESCE(NULLIF(u.display_name, ''), 'Someone') AS who,
               t.id AS thread_id, t.title, left(regexp_replace(r.content, '<[^>]+>', ' ', 'g'), 160) AS text
        FROM replies r JOIN threads t ON t.id = r.thread_id JOIN users u ON u.id = r.user_id
        WHERE t.author_id = ANY(${ids}::uuid[]) ${orgOnly} AND r.user_id <> ALL(${ids}::uuid[])
        UNION ALL
        SELECT x.created_at, 'reaction', COALESCE(NULLIF(u.display_name, ''), 'Someone'), t.id, t.title, x.kind
        FROM reactions x JOIN threads t ON t.id = x.thread_id JOIN users u ON u.id = x.user_id
        WHERE t.author_id = ANY(${ids}::uuid[]) ${orgOnly} AND x.reply_id IS NULL AND x.user_id <> ALL(${ids}::uuid[])
        UNION ALL
        SELECT bm.created_at, 'bookmark', COALESCE(NULLIF(u.display_name, ''), 'Someone'), t.id, t.title, NULL
        FROM bookmarks bm JOIN threads t ON t.id = bm.thread_id JOIN users u ON u.id = bm.user_id
        WHERE t.author_id = ANY(${ids}::uuid[]) ${orgOnly} AND bm.reply_id IS NULL AND bm.user_id <> ALL(${ids}::uuid[])
      ) a ORDER BY at DESC LIMIT 20`,
  ]);

  const t = totals[0] ?? {};
  const postRows: PostInsight[] = posts.map((r) => ({
    threadId: String(r.id), orgId: String(r.org_id), orgName: (r.org_name as string | null) ?? null,
    title: String(r.title), slug: String(r.slug), kind: String(r.kind), visibility: String(r.visibility),
    publishedAt: iso(r.published_at),
    views: n(r.views), visitors: n(r.visitors), avgDurationSec: Math.round(n(r.avg_dur)),
    topSource: r.source_kind ? { kind: r.source_kind as SourceKind, host: (r.referrer_host as string | null) ?? null } : null,
    repliesInRange: n(r.r_in), repliesTotal: n(r.r_tot), reactionsInRange: n(r.x_in), reactionsTotal: n(r.x_tot),
    bookmarksTotal: n(r.b_tot), lastActivityAt: iso(r.last_activity_at),
  }));

  return {
    range: opts.range, from: from.toISOString(), to: to.toISOString(),
    totals: {
      posts: postRows.length, views: n(t.views), visitors: n(t.visitors), signedInReaders: n(t.readers),
      replies: postRows.reduce((s, p) => s + p.repliesInRange, 0),
      reactions: postRows.reduce((s, p) => s + p.reactionsInRange, 0),
      bookmarks: postRows.reduce((s, p) => s + p.bookmarksTotal, 0),
    },
    daily: daily.map((r) => ({ day: String(r.day), views: n(r.c) })),
    sources: sources.map((r) => ({ kind: (r.kind ?? 'direct') as SourceKind, referrerHost: (r.host as string | null) ?? null, visits: n(r.c) })),
    posts: postRows,
    activity: activity.map((r) => ({
      at: new Date(r.at as string).toISOString(), type: r.type as ActivityItem['type'], who: String(r.who),
      threadId: String(r.thread_id), threadTitle: String(r.title), text: (r.text as string | null)?.trim() || null,
    })),
  };
}
