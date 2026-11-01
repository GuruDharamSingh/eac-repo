import { db } from '@elkdonis/db';
import { CO_HOST_ROLE, HOST_ROLE } from './meeting-rota';
import { SERIES_SESSION_KIND } from './thread-kinds';

/**
 * The people of one meeting series, for its planner's Manage tab ("Email list")
 * and the CSV export (docs/open/SERIES_EMAIL_DESIGN_2026-10-10.md §2, "The
 * list is a query, not a contacts mirror").
 *
 * One row per person who has touched the series in any of three ways:
 *   - subscribed: a `thread_rsvps` row with status 'subscribed' on the
 *     series thread itself;
 *   - coming: a 'yes' on a `series_session` topic of the series
 *     (`metadata.seriesSession.seriesId`); archived topics are left out,
 *     because a week whose date moved away leaves its old topic archived;
 *   - hosting: a `meeting_hosts` row (host or co-host) on the series thread.
 *
 * `orgUnsubscribed` marks a person whose address is `unsubscribed` in the
 * org's `contacts` (matched on lower(email)); it does not remove them here.
 *
 * Read-only. Scoped to `orgId` throughout: the series thread, its week topics
 * and the contacts row must all belong to the org, and a series of another
 * org returns null. The series thread may be of kind meeting (today's IFAC
 * series), event, workshop or series.
 */

const SERIES_THREAD_KINDS = ['meeting', 'event', 'workshop', 'series'];
const SUBSCRIBED = 'subscribed';

export interface SeriesPerson {
  userId: string;
  name: string;
  email: string;
  subscribed: boolean;
  /** Distinct weeks (series_session topics) the person said yes to. */
  weeksComing: number;
  /** Distinct week dates the person hosts or co-hosts. */
  weeksHosting: number;
  /** Earliest of their subscription, RSVPs and host assignments. */
  firstSeen: string | null;
  /** Latest week they are coming to or hosting. */
  lastWeekAt: string | null;
  orgUnsubscribed: boolean;
}

export interface SeriesPeopleCounts {
  people: number;
  subscribed: number;
  /** Coming to at least one week. */
  coming: number;
  /** Hosting or co-hosting at least one week. */
  hosts: number;
  orgUnsubscribed: number;
}

export interface SeriesPeople {
  seriesId: string;
  slug: string;
  title: string;
  counts: SeriesPeopleCounts;
  people: SeriesPerson[];
}

type Row = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  subscribed: boolean;
  weeks_coming: number;
  weeks_hosting: number;
  first_seen: Date | null;
  last_week_at: Date | null;
  org_unsubscribed: boolean;
};

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

export async function listSeriesPeople(orgId: string, seriesId: string): Promise<SeriesPeople | null> {
  const [series] = await db<Array<{ id: string; slug: string; title: string }>>`
    SELECT id, slug, title FROM threads
    WHERE id = ${seriesId} AND org_id = ${orgId} AND kind = ANY(${SERIES_THREAD_KINDS})
    LIMIT 1
  `;
  if (!series) return null;

  // touch: one line per subscription, week RSVP and host assignment.
  // A week's date is its topic's occurrenceAt, falling back to scheduled_at.
  // Weeks hosting counts distinct dates, so host and co-host of the same week
  // count once. The contacts join is on the org's unique (org_id, lower(email)).
  const rows = await db<Row[]>`
    WITH weeks AS (
      SELECT t.id,
             COALESCE((t.metadata->'seriesSession'->>'occurrenceAt')::timestamptz, t.scheduled_at) AS at
      FROM threads t
      WHERE t.org_id = ${orgId}
        AND t.kind = ${SERIES_SESSION_KIND}
        AND t.status <> 'archived'
        AND t.metadata->'seriesSession'->>'seriesId' = ${series.id}
    ),
    touch AS (
      SELECT r.user_id, 'subscribed'::text AS what, r.created_at AS seen,
             NULL::text AS week_id, NULL::timestamptz AS week_at
      FROM thread_rsvps r
      WHERE r.thread_id = ${series.id} AND r.status = ${SUBSCRIBED}
      UNION ALL
      SELECT r.user_id, 'coming', r.created_at, w.id, w.at
      FROM thread_rsvps r JOIN weeks w ON w.id = r.thread_id
      WHERE r.status = 'yes'
      UNION ALL
      SELECT h.user_id, 'hosting', h.created_at, NULL, h.occurrence_at
      FROM meeting_hosts h
      WHERE h.thread_id = ${series.id}
        AND h.user_id IS NOT NULL
        AND h.role IN (${HOST_ROLE}, ${CO_HOST_ROLE})
    )
    SELECT u.id AS user_id,
           u.display_name,
           u.email,
           bool_or(x.what = 'subscribed') AS subscribed,
           (count(DISTINCT x.week_id) FILTER (WHERE x.what = 'coming'))::int AS weeks_coming,
           (count(DISTINCT x.week_at) FILTER (WHERE x.what = 'hosting'))::int AS weeks_hosting,
           min(x.seen) AS first_seen,
           max(x.week_at) AS last_week_at,
           bool_or(c.id IS NOT NULL) AS org_unsubscribed
    FROM touch x
    JOIN users u ON u.id = x.user_id
    LEFT JOIN contacts c
      ON c.org_id = ${orgId}
     AND u.email IS NOT NULL
     AND lower(c.email) = lower(u.email)
     AND c.status = 'unsubscribed'
    GROUP BY u.id, u.display_name, u.email
    ORDER BY lower(COALESCE(NULLIF(trim(u.display_name), ''), u.email, '')), u.id
  `;

  const people: SeriesPerson[] = rows.map((r) => {
    const email = r.email ?? '';
    return {
      userId: r.user_id,
      name: r.display_name?.trim() || email.split('@')[0] || 'Unnamed',
      email,
      subscribed: Boolean(r.subscribed),
      weeksComing: Number(r.weeks_coming) || 0,
      weeksHosting: Number(r.weeks_hosting) || 0,
      firstSeen: iso(r.first_seen),
      lastWeekAt: iso(r.last_week_at),
      orgUnsubscribed: Boolean(r.org_unsubscribed),
    };
  });

  return {
    seriesId: series.id,
    slug: series.slug,
    title: series.title,
    counts: {
      people: people.length,
      subscribed: people.filter((p) => p.subscribed).length,
      coming: people.filter((p) => p.weeksComing > 0).length,
      hosts: people.filter((p) => p.weeksHosting > 0).length,
      orgUnsubscribed: people.filter((p) => p.orgUnsubscribed).length,
    },
    people,
  };
}
