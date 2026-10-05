import { db } from '@elkdonis/db';
import { RANGES, type RangeKey, type SourceKind } from './index';
import type {
  BreakdownRow, CampaignRow, DashboardData, DailyPoint, EventRow, GeoRow, PageRow,
  PersonRow, Scope, SiteRow, SourceRow, Totals,
} from './types';

// ---------------------------------------------------------------------------
// Read side. Every query is scoped by `scope` (one org, or the whole network)
// and a half-open time range, and ignores rows that carry no path only where a
// path is needed — private views still count toward totals.
// ---------------------------------------------------------------------------

export interface DashboardOptions {
  scope: Scope;
  range: RangeKey;
  /** IANA zone for day and hour buckets. Default UTC. */
  timeZone?: string;
  /** Include the list of signed-in people. Only for viewers allowed to see them. */
  includePeople?: boolean;
}

function validZone(tz: string | undefined): string {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

const n = (v: unknown) => Number(v ?? 0);

function scopeSql(scope: Scope) {
  return 'orgId' in scope ? db`e.org_id = ${scope.orgId}` : db`TRUE`;
}

async function totals(scope: Scope, from: Date, to: Date): Promise<Totals> {
  const sc = scopeSql(scope);
  const [t] = await db<Array<Record<string, unknown>>>`
    SELECT count(*) FILTER (WHERE e.kind = 'pageview') AS pageviews,
           count(DISTINCT e.visitor_id) FILTER (WHERE e.kind = 'pageview') AS visitors,
           count(*) FILTER (WHERE e.kind = 'pageview' AND e.is_entry) AS visits,
           COALESCE(avg(e.duration_ms) FILTER (WHERE e.kind = 'pageview' AND e.duration_ms IS NOT NULL), 0) / 1000.0 AS avg_dur,
           count(DISTINCT e.user_id) FILTER (WHERE e.user_id IS NOT NULL) AS members
    FROM analytics_events e
    WHERE ${sc} AND e.occurred_at >= ${from} AND e.occurred_at < ${to}
  `;
  const [b] = await db<Array<Record<string, unknown>>>`
    SELECT count(*) AS sessions, count(*) FILTER (WHERE pv = 1) AS bounced
    FROM (
      SELECT e.session_id, count(*) AS pv FROM analytics_events e
      WHERE ${sc} AND e.kind = 'pageview' AND e.occurred_at >= ${from} AND e.occurred_at < ${to}
      GROUP BY e.session_id
    ) s
  `;
  const sessions = n(b?.sessions);
  return {
    pageviews: n(t?.pageviews),
    visitors: n(t?.visitors),
    visits: n(t?.visits),
    bounceRate: sessions ? n(b?.bounced) / sessions : 0,
    avgDurationSec: Math.round(n(t?.avg_dur)),
    members: n(t?.members),
  };
}

export async function getDashboardData(opts: DashboardOptions): Promise<DashboardData> {
  const { scope, range } = opts;
  const days = RANGES.find((r) => r.key === range)?.days ?? 30;
  const tz = validZone(opts.timeZone);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const prevFrom = new Date(from.getTime() - days * 86_400_000);
  const sc = scopeSql(scope);
  const inRange = db`e.occurred_at >= ${from} AND e.occurred_at < ${to}`;

  const [
    live, cur, prev, daily, hours, weekdays, pages, entries, sources, campaigns,
    countries, regions, devices, browsers, systems, events, sites, priv, people,
  ] = await Promise.all([
    db<Array<{ c: number }>>`
      SELECT count(DISTINCT e.visitor_id)::int AS c FROM analytics_events e
      WHERE ${sc} AND e.occurred_at > NOW() - INTERVAL '5 minutes'`,
    totals(scope, from, to),
    totals(scope, prevFrom, from),
    db<Array<Record<string, unknown>>>`
      SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(x.pv, 0) AS pv, COALESCE(x.vis, 0) AS vis
      FROM generate_series(
             date_trunc('day', ${from}::timestamptz AT TIME ZONE ${tz}),
             date_trunc('day', ${to}::timestamptz AT TIME ZONE ${tz}),
             INTERVAL '1 day') d
      LEFT JOIN (
        SELECT date_trunc('day', e.occurred_at AT TIME ZONE ${tz}) AS day,
               count(*) AS pv, count(DISTINCT e.visitor_id) AS vis
        FROM analytics_events e
        WHERE ${sc} AND e.kind = 'pageview' AND ${inRange}
        GROUP BY 1
      ) x ON x.day = d
      ORDER BY d`,
    db<Array<Record<string, unknown>>>`
      SELECT extract(hour FROM e.occurred_at AT TIME ZONE ${tz})::int AS k, count(*) AS c
      FROM analytics_events e WHERE ${sc} AND e.kind = 'pageview' AND ${inRange} GROUP BY 1`,
    db<Array<Record<string, unknown>>>`
      SELECT extract(dow FROM e.occurred_at AT TIME ZONE ${tz})::int AS k, count(*) AS c
      FROM analytics_events e WHERE ${sc} AND e.kind = 'pageview' AND ${inRange} GROUP BY 1`,
    pageRows(scope, from, to, false),
    pageRows(scope, from, to, true),
    db<Array<Record<string, unknown>>>`
      SELECT e.source_kind AS kind, e.referrer_host AS host, count(*) AS c
      FROM analytics_events e
      WHERE ${sc} AND e.kind = 'pageview' AND e.is_entry AND ${inRange}
      GROUP BY 1, 2 ORDER BY c DESC LIMIT 15`,
    db<Array<Record<string, unknown>>>`
      SELECT e.utm_source AS s, e.utm_medium AS m, e.utm_campaign AS c, count(*) AS v
      FROM analytics_events e
      WHERE ${sc} AND e.kind = 'pageview' AND e.is_entry AND ${inRange}
        AND (e.utm_source IS NOT NULL OR e.utm_medium IS NOT NULL OR e.utm_campaign IS NOT NULL)
      GROUP BY 1, 2, 3 ORDER BY v DESC LIMIT 15`,
    db<Array<Record<string, unknown>>>`
      SELECT e.country AS country, NULL AS region, count(DISTINCT e.visitor_id) AS v
      FROM analytics_events e
      WHERE ${sc} AND e.kind = 'pageview' AND e.country IS NOT NULL AND ${inRange}
      GROUP BY 1 ORDER BY v DESC LIMIT 15`,
    db<Array<Record<string, unknown>>>`
      SELECT e.country AS country, e.region AS region, count(DISTINCT e.visitor_id) AS v
      FROM analytics_events e
      WHERE ${sc} AND e.kind = 'pageview' AND e.region IS NOT NULL AND ${inRange}
      GROUP BY 1, 2 ORDER BY v DESC LIMIT 15`,
    breakdown(scope, from, to, 'device'),
    breakdown(scope, from, to, 'browser'),
    breakdown(scope, from, to, 'os'),
    db<Array<Record<string, unknown>>>`
      SELECT e.name AS name, count(*) AS c, count(DISTINCT e.visitor_id) AS v
      FROM analytics_events e
      WHERE ${sc} AND e.kind = 'event' AND ${inRange}
      GROUP BY 1 ORDER BY c DESC LIMIT 15`,
    db<Array<Record<string, unknown>>>`
      SELECT e.host AS host, e.org_id AS org_id, max(o.name) AS org_name,
             count(*) AS pv, count(DISTINCT e.visitor_id) AS v
      FROM analytics_events e LEFT JOIN organizations o ON o.id = e.org_id
      WHERE ${sc} AND e.kind = 'pageview' AND ${inRange}
      GROUP BY 1, 2 ORDER BY pv DESC LIMIT 25`,
    db<Array<{ c: number }>>`
      SELECT count(*)::int AS c FROM analytics_events e
      WHERE ${sc} AND e.kind = 'pageview' AND e.is_private AND ${inRange}`,
    opts.includePeople ? peopleRows(scope, from) : Promise.resolve(null),
  ]);

  const dailyRows: DailyPoint[] = daily.map((r) => ({ day: String(r.day), pageviews: n(r.pv), visitors: n(r.vis) }));
  const byHour = new Map(hours.map((r) => [n(r.k), n(r.c)]));
  const byDow = new Map(weekdays.map((r) => [n(r.k), n(r.c)]));

  return {
    range,
    from: from.toISOString(),
    to: to.toISOString(),
    timeZone: tz,
    scope,
    liveVisitors: live[0]?.c ?? 0,
    totals: cur,
    previous: prev,
    daily: dailyRows,
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, pageviews: byHour.get(hour) ?? 0 })),
    weekdays: Array.from({ length: 7 }, (_, dow) => ({ dow, pageviews: byDow.get(dow) ?? 0 })),
    pages,
    entryPages: entries,
    sources: sources.map<SourceRow>((r) => ({
      kind: (r.kind ?? 'direct') as SourceKind,
      referrerHost: (r.host as string | null) ?? null,
      visits: n(r.c),
    })),
    campaigns: campaigns.map<CampaignRow>((r) => ({
      source: (r.s as string | null) ?? null,
      medium: (r.m as string | null) ?? null,
      campaign: (r.c as string | null) ?? null,
      visits: n(r.v),
    })),
    countries: countries.map<GeoRow>((r) => ({ country: String(r.country), region: null, visitors: n(r.v) })),
    regions: regions.map<GeoRow>((r) => ({ country: String(r.country), region: String(r.region), visitors: n(r.v) })),
    devices, browsers, systems,
    events: events.map<EventRow>((r) => ({ name: String(r.name), count: n(r.c), visitors: n(r.v) })),
    sites: sites.map<SiteRow>((r) => ({
      host: String(r.host),
      orgId: (r.org_id as string | null) ?? null,
      orgName: (r.org_name as string | null) ?? null,
      pageviews: n(r.pv),
      visitors: n(r.v),
    })),
    privateViews: priv[0]?.c ?? 0,
    people,
  };
}

async function pageRows(scope: Scope, from: Date, to: Date, entryOnly: boolean): Promise<PageRow[]> {
  const sc = scopeSql(scope);
  const rows = await db<Array<Record<string, unknown>>>`
    SELECT e.path AS path, e.thread_id AS thread_id, max(t.title) AS title,
           count(*) AS views, count(DISTINCT e.visitor_id) AS visitors,
           COALESCE(avg(e.duration_ms), 0) / 1000.0 AS avg_dur
    FROM analytics_events e LEFT JOIN threads t ON t.id = e.thread_id
    WHERE ${sc} AND e.kind = 'pageview' AND e.path IS NOT NULL
      AND e.occurred_at >= ${from} AND e.occurred_at < ${to}
      ${entryOnly ? db`AND e.is_entry` : db``}
    GROUP BY e.path, e.thread_id ORDER BY views DESC LIMIT 15`;
  return rows.map((r) => ({
    path: String(r.path),
    threadId: (r.thread_id as string | null) ?? null,
    title: (r.title as string | null) ?? null,
    views: n(r.views),
    visitors: n(r.visitors),
    avgDurationSec: Math.round(n(r.avg_dur)),
  }));
}

async function breakdown(scope: Scope, from: Date, to: Date, column: 'device' | 'browser' | 'os'): Promise<BreakdownRow[]> {
  const sc = scopeSql(scope);
  const col = db(column);
  const rows = await db<Array<Record<string, unknown>>>`
    SELECT e.${col} AS label, count(DISTINCT e.visitor_id) AS v
    FROM analytics_events e
    WHERE ${sc} AND e.kind = 'pageview' AND e.${col} IS NOT NULL
      AND e.occurred_at >= ${from} AND e.occurred_at < ${to}
    GROUP BY 1 ORDER BY v DESC LIMIT 8`;
  return rows.map((r) => ({ label: String(r.label), visitors: n(r.v) }));
}

async function peopleRows(scope: Scope, from: Date): Promise<PersonRow[]> {
  const filter = 'orgId' in scope ? db`v.org_id = ${scope.orgId}` : db`TRUE`;
  const rows = await db<Array<Record<string, unknown>>>`
    SELECT u.id AS id, COALESCE(NULLIF(u.display_name, ''), u.email, 'Member') AS name,
           sum(v.visit_count) AS visits, sum(v.page_count) AS pages,
           min(v.first_seen_at) AS first_seen, max(v.last_seen_at) AS last_seen
    FROM user_site_visits v JOIN users u ON u.id = v.user_id
    WHERE ${filter} AND v.last_seen_at >= ${from}
    GROUP BY u.id, name ORDER BY last_seen DESC LIMIT 25`;
  return rows.map((r) => ({
    userId: String(r.id),
    name: String(r.name),
    visits: n(r.visits),
    pageviews: n(r.pages),
    firstSeen: new Date(r.first_seen as string).toISOString(),
    lastSeen: new Date(r.last_seen as string).toISOString(),
  }));
}
