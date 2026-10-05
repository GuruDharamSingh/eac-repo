import { db } from '@elkdonis/db';
import { RANGES, type RangeKey } from './index';
import type { Scope } from './types';

// ---------------------------------------------------------------------------
// Progression: how far visitors get through an ordered list of steps, and the
// routes they actually take. Both work on sessions (a visit = one session id).
// ---------------------------------------------------------------------------

export interface FunnelStep {
  label: string;
  /** Matches a page view whose path matches this POSIX regex, e.g. '^/artworks/[0-9a-f-]{36}$'. */
  path?: string;
  /** Matches a named event (trackEvent / trackServerEvent). */
  event?: string;
}

export interface FunnelRow {
  label: string;
  /** Sessions that reached this step after reaching every earlier step. */
  sessions: number;
  /** Share of the previous step (1 for the first). */
  fromPrevious: number;
  /** Share of the first step. */
  fromStart: number;
}

export interface JourneyRow {
  /** Pages in order, consecutive repeats collapsed, ids replaced by :id. */
  steps: string[];
  sessions: number;
}

export interface ProgressionData {
  range: RangeKey;
  funnel: FunnelRow[];
  journeys: JourneyRow[];
  /** Sessions in range with at least one page view. */
  sessions: number;
}

const n = (v: unknown) => Number(v ?? 0);

function scopeSql(scope: Scope) {
  return 'orgId' in scope ? db`e.org_id = ${scope.orgId}` : db`TRUE`;
}

function match(step: FunnelStep) {
  if (step.event) return db`(e.kind = 'event' AND e.name = ${step.event})`;
  if (step.path) return db`(e.kind = 'pageview' AND e.path ~ ${step.path})`;
  return db`FALSE`;
}

/** Ordered funnel: step k counts sessions whose step-k hit came at or after their step k-1 hit. */
export async function getFunnel(opts: { scope: Scope; range: RangeKey; steps: FunnelStep[]; host?: string }): Promise<FunnelRow[]> {
  const { scope, steps } = opts;
  if (steps.length === 0) return [];
  const days = RANGES.find((r) => r.key === opts.range)?.days ?? 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const sc = scopeSql(scope);
  const inRange = db`e.occurred_at >= ${from} AND e.occurred_at < ${to}`;
  const hostOnly = opts.host ? db`AND e.host = ${opts.host}` : db``;

  // s1 AS (...), s2 AS (... JOIN s1 ...), ... then count each.
  let ctes = db`s1 AS (
    SELECT e.session_id, min(e.occurred_at) AS t FROM analytics_events e
    WHERE ${sc} AND ${inRange} ${hostOnly} AND ${match(steps[0])} GROUP BY 1)`;
  for (let i = 1; i < steps.length; i++) {
    const prev = db(`s${i}`);
    const cur = db(`s${i + 1}`);
    ctes = db`${ctes}, ${cur} AS (
      SELECT e.session_id, min(e.occurred_at) AS t FROM analytics_events e
      JOIN ${prev} p ON p.session_id = e.session_id
      WHERE ${sc} AND ${inRange} ${hostOnly} AND e.occurred_at >= p.t AND ${match(steps[i])} GROUP BY 1)`;
  }
  const counts = steps.map((_, i) => db`(SELECT count(*) FROM ${db(`s${i + 1}`)}) AS ${db(`c${i + 1}`)}`);
  const selectList = counts.reduce((acc, c, i) => (i === 0 ? c : db`${acc}, ${c}`));
  const [row] = await db<Array<Record<string, unknown>>>`WITH ${ctes} SELECT ${selectList}`;

  const sessions = steps.map((_, i) => n(row?.[`c${i + 1}`]));
  return steps.map((s, i) => ({
    label: s.label,
    sessions: sessions[i],
    fromPrevious: i === 0 ? 1 : sessions[i - 1] ? sessions[i] / sessions[i - 1] : 0,
    fromStart: sessions[0] ? sessions[i] / sessions[0] : 0,
  }));
}

const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** The most common routes through the site, as page sequences per visit. */
export async function getJourneys(opts: { scope: Scope; range: RangeKey; host?: string; maxSteps?: number; limit?: number }): Promise<{ journeys: JourneyRow[]; sessions: number }> {
  const days = RANGES.find((r) => r.key === opts.range)?.days ?? 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const sc = scopeSql(opts.scope);
  const hostOnly = opts.host ? db`AND e.host = ${opts.host}` : db``;
  const maxSteps = opts.maxSteps ?? 5;

  const rows = await db<Array<{ pages: string[] }>>`
    SELECT array_agg(p ORDER BY t) AS pages FROM (
      SELECT e.session_id AS s, e.occurred_at AS t,
             regexp_replace(regexp_replace(e.path, ${UUID_RE}, ':id', 'g'), '/[0-9]+(/|$)', '/:n\\1', 'g') AS p
      FROM analytics_events e
      WHERE ${sc} AND e.kind = 'pageview' AND e.path IS NOT NULL ${hostOnly}
        AND e.occurred_at >= ${from} AND e.occurred_at < ${to}
    ) x GROUP BY s`;

  const counts = new Map<string, JourneyRow>();
  for (const r of rows) {
    const steps: string[] = [];
    for (const p of r.pages) {
      if (steps[steps.length - 1] !== p) steps.push(p);
      if (steps.length >= maxSteps) break;
    }
    const key = steps.join(' › ');
    const hit = counts.get(key);
    if (hit) hit.sessions++;
    else counts.set(key, { steps, sessions: 1 });
  }
  const journeys = [...counts.values()].sort((a, b) => b.sessions - a.sessions).slice(0, opts.limit ?? 12);
  return { journeys, sessions: rows.length };
}

export async function getProgression(opts: { scope: Scope; range: RangeKey; steps: FunnelStep[]; host?: string }): Promise<ProgressionData> {
  const [funnel, j] = await Promise.all([getFunnel(opts), getJourneys(opts)]);
  return { range: opts.range, funnel, journeys: j.journeys, sessions: j.sessions };
}
