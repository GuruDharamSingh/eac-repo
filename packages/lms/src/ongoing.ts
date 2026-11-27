// ============================================================================
// ONGOING SESSIONS (workspace slice 4a; migration 285; design: docs/open/DEVELOPMENT_APP_2026-11-20/workspace-threads.md)
//
// A repeating session (a module whose one step repeats every N days from a start date): per-interval material, one entry
// per person per interval (edited in place), closing at the WRITER'S own local midnight, entries filed under the writer's
// own day. The clock rules are pure (intervals.ts); the clock and the zone are passed in, so tests control them.
//
// Reads follow the journal's rules exactly (workspaces.ts listRunJournal): your own entries; `circle` entries for people in
// the run and its guides; `guide` entries for the guides named on the run only; never another person's `me` entry; org
// staff and admins get nothing from their role. On top of that the ongoing view adds the per-session gate:
//   - a FUTURE interval shows no one else's entries (guides excepted);
//   - the CURRENT interval shows others only once you have entered, unless the session is read-first (guides always);
//   - PAST intervals are readable by everyone in the workspace.
// Everything fails soft: until migration 285 exists, every function here answers "no ongoing sessions".
// ============================================================================
import { db } from '@elkdonis/db';
import type { LmsViewer, ResponseKind, ResponseVisibility, WriteResult } from './types';
import { addDaysKey, currentInterval, intervalClosesAt, intervalState, isIntervalKey, validTz, type IntervalSpec } from './intervals';
import { commentsFor, commentsTableExists, doingFor, getWorkspaceView, journalAccess, ongoingAvailable, type RunJournalComment } from './workspaces';
import { getRun, isRunStaff } from './delivery';
import { newId } from './util';

export interface OngoingSession {
  moduleId: string;
  stepId: string;
  everyDays: number;
  /** "YYYY-MM-DD" */
  start: string;
  end: string | null;
  closes: boolean;
  readFirst: boolean;
  show: 5 | 7;
}
const spec = (s: OngoingSession): IntervalSpec => ({ everyDays: s.everyDays, start: s.start, end: s.end, closes: s.closes });

interface CadenceRow { scope_key: string; step_id: string | null; every_days: number; start_date: string; end_date: string | null; closes: boolean; read_first: boolean; show_count: number }
const mapSession = (r: CadenceRow): OngoingSession => ({
  moduleId: r.scope_key, stepId: r.step_id ?? '', everyDays: r.every_days, start: String(r.start_date).slice(0, 10),
  end: r.end_date ? String(r.end_date).slice(0, 10) : null, closes: r.closes, readFirst: r.read_first, show: r.show_count === 7 ? 7 : 5,
});

/** The ongoing sessions of a run. Empty (never an error) until migration 285 exists. */
export async function listOngoingSessions(runId: string): Promise<OngoingSession[]> {
  if (!(await ongoingAvailable())) return [];
  const rows = await db<CadenceRow[]>`
    SELECT scope_key, step_id, every_days, start_date::text, end_date::text, closes, read_first, show_count
    FROM workspace_cadences WHERE host_type = 'lms_run' AND host_id = ${runId} ORDER BY created_at
  `;
  return rows.map(mapSession);
}

// ── guides: set up a session and plan its intervals ─────────────────────────
export interface MaterialItem { id: string; name: string; url?: string; access: 'open' | 'participants' }
export interface IntervalPlanOut { note: string | null; items: MaterialItem[] }

const clean = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
function cleanItems(items: unknown): MaterialItem[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 30).flatMap((m: Partial<MaterialItem>) => {
    const name = clean(m?.name, 160);
    if (!name) return [];
    const url = clean(m?.url, 500);
    return [{ id: clean(m.id, 40) ?? newId().slice(0, 8), name, ...(url ? { url } : {}), access: m.access === 'open' ? ('open' as const) : ('participants' as const) }];
  });
}

/** Make a module an ongoing session of a run (or change it). Staff of the run only. */
export async function saveOngoingSession(viewer: LmsViewer, runId: string, s: OngoingSession): Promise<WriteResult> {
  if (!(await ongoingAvailable())) return { ok: false, error: 'Ongoing sessions are not switched on yet.' };
  const run = await getRun(runId);
  if (!run || !(await isRunStaff(viewer, run))) return { ok: false, error: 'Guides only.' };
  const sp = spec(s);
  if (!Number.isInteger(s.everyDays) || s.everyDays < 1 || s.everyDays > 31) return { ok: false, error: 'Every 1 to 31 days.' };
  if (!isIntervalKey({ ...sp, end: null }, s.start)) return { ok: false, error: 'Give the first day as a date.' };
  if (s.end && s.end < s.start) return { ok: false, error: 'The end comes before the start.' };
  const [st] = await db`SELECT 1 FROM lms_steps WHERE id = ${s.stepId} AND course_id = ${run.courseId}`;
  if (!st) return { ok: false, error: 'That step is not part of this course.' };
  await db`
    INSERT INTO workspace_cadences (host_type, host_id, scope_key, step_id, every_days, start_date, end_date, closes, read_first, show_count)
    VALUES ('lms_run', ${runId}, ${s.moduleId}, ${s.stepId}, ${s.everyDays}, ${s.start}::date, ${s.end}::date, ${s.closes}, ${s.readFirst}, ${s.show})
    ON CONFLICT (host_type, host_id, scope_key) DO UPDATE SET step_id = EXCLUDED.step_id, every_days = EXCLUDED.every_days, start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date, closes = EXCLUDED.closes, read_first = EXCLUDED.read_first, show_count = EXCLUDED.show_count, updated_at = NOW()
  `;
  return { ok: true };
}

/** A note and material for one interval (or, with key '', for the whole session). Staff of the run only. */
export async function saveIntervalPlan(viewer: LmsViewer, runId: string, moduleId: string, key: string, plan: { note?: string | null; items?: MaterialItem[] }): Promise<WriteResult> {
  if (!(await ongoingAvailable())) return { ok: false, error: 'Ongoing sessions are not switched on yet.' };
  const run = await getRun(runId);
  if (!run || !(await isRunStaff(viewer, run))) return { ok: false, error: 'Guides only.' };
  const [row] = await db<CadenceRow[]>`SELECT scope_key, step_id, every_days, start_date::text, end_date::text, closes, read_first, show_count FROM workspace_cadences WHERE host_type = 'lms_run' AND host_id = ${runId} AND scope_key = ${moduleId}`;
  if (!row) return { ok: false, error: 'That session is not ongoing.' };
  if (key !== '' && !isIntervalKey(spec(mapSession(row)), key)) return { ok: false, error: 'That is not one of this session’s days.' };
  const note = clean(plan.note ?? undefined, 2000) ?? null;
  const items = cleanItems(plan.items);
  await db`
    INSERT INTO workspace_materials (host_type, host_id, scope_key, interval_key, note, items, updated_by)
    VALUES ('lms_run', ${runId}, ${moduleId}, ${key}, ${note}, ${db.json(items as never)}, ${viewer.userId})
    ON CONFLICT (host_type, host_id, scope_key, interval_key) DO UPDATE SET note = EXCLUDED.note, items = EXCLUDED.items, updated_by = EXCLUDED.updated_by, updated_at = NOW()
  `;
  return { ok: true };
}

// ── the view of one ongoing session, for one reader ─────────────────────────
export interface OngoingEntry {
  id: string;
  /** The interval this entry answers: its writer's own local day. */
  intervalKey: string;
  kind: Exclude<ResponseKind, 'note'>;
  body: string;
  visibility: ResponseVisibility;
  createdAt: Date;
  updatedAt: Date;
  mine: boolean;
  /** "viewer" when mine; a named guide's user id; otherwise the writer's seat id (never a user id). */
  authorKey: string;
  authorName: string;
  authorIsGuide: boolean;
  comments: RunJournalComment[];
}
export interface OngoingView {
  moduleId: string;
  /** The zone used for this reader. */
  tz: string;
  /** What "now" is for this reader. */
  today: { state: 'before'; opensOn: string } | { state: 'running'; key: string } | { state: 'ended' };
  /** The ISO instant the current interval closes for this reader (null when none is running). */
  closesAt: string | null;
  plans: Record<string, IntervalPlanOut>;
  entries: OngoingEntry[];
  /** How many other people's entries the reader could read in each interval if the gate were open (counts only, never words). */
  entered: Record<string, number>;
  commentsMode: 'everyone' | 'guide';
  isGuide: boolean;
}

interface ERow {
  id: string; interval_key: string; kind: Exclude<ResponseKind, 'note'>; body: string; visibility: ResponseVisibility; created_at: Date; updated_at: Date;
  user_id: string; enrolment_id: string; author_name: string | null; author_guide: boolean;
}

/**
 * One ongoing session as this reader may see it, on their own clock. Null when they are neither seated in the run nor named on it,
 * or the session does not exist. `tzIn` is what the browser reported; for a seated participant it is stored on the seat.
 */
export async function getOngoingView(viewer: LmsViewer, courseSlug: string, moduleId: string, tzIn?: string | null, now: Date = new Date()): Promise<OngoingView | null> {
  if (!viewer.userId || !(await ongoingAvailable())) return null;
  const view = await getWorkspaceView(viewer, courseSlug);
  if (!view?.run) return null;
  const run = view.run;
  const { seated, isGuide } = await journalAccess(viewer, run.id);
  if (!seated && !isGuide) return null;
  const session = (await listOngoingSessions(run.id)).find((s) => s.moduleId === moduleId);
  if (!session) return null;
  const sp = spec(session);

  // The reader's zone: the browser's report, else the one stored on the seat, else the site default. A seat keeps the latest report.
  const [seat] = await db<Array<{ id: string; tz: string | null }>>`SELECT id, tz FROM lms_enrolments WHERE run_id = ${run.id} AND user_id = ${viewer.userId} AND status <> 'withdrawn'`;
  // The stored zone decides closing; the browser only fills an empty seat. A later claim of another zone changes nothing.
  const tz = validTz(seat?.tz ?? tzIn);
  if (seat && !seat.tz && tzIn && validTz(tzIn) === tzIn) await db`UPDATE lms_enrolments SET tz = ${tzIn} WHERE id = ${seat.id}`;

  const cur = currentInterval(sp, now, tz);
  const curKey = cur.state === 'running' ? cur.key : null;
  const today: OngoingView['today'] = cur.state === 'running' ? { state: 'running', key: cur.key } : cur;
  const closesAt = curKey ? intervalClosesAt(sp, curKey, tz).toISOString() : null;

  // Material: guides read every interval; everyone else only up to and including the current one.
  const mats = await db<Array<{ interval_key: string; note: string | null; items: MaterialItem[] }>>`
    SELECT interval_key, note, items FROM workspace_materials WHERE host_type = 'lms_run' AND host_id = ${run.id} AND scope_key = ${moduleId}
  `;
  const plans: Record<string, IntervalPlanOut> = {};
  for (const m of mats) {
    if (!isGuide && m.interval_key !== '') {
      const ended = cur.state === 'ended';
      if (cur.state === 'before' || (!ended && curKey !== null && m.interval_key > curKey)) continue;
    }
    plans[m.interval_key] = { note: m.note, items: (m.items ?? []).filter((i) => isGuide || i.access === 'open' || seated) };
  }

  // Entries, by the journal's own read rule.
  const guideOk = isGuide ? db`TRUE` : db`FALSE`;
  const rows = await db<ERow[]>`
    SELECT r.id, r.interval_key, r.kind, r.body, r.visibility, r.created_at, r.updated_at, r.user_id, r.enrolment_id,
           u.display_name AS author_name,
           EXISTS (SELECT 1 FROM lms_run_staff s WHERE s.run_id = r.run_id AND s.user_id = r.user_id) AS author_guide
    FROM lms_responses r
    JOIN users u ON u.id = r.user_id
    JOIN lms_enrolments en ON en.id = r.enrolment_id
    WHERE r.run_id = ${run.id} AND r.step_id = ${session.stepId} AND r.interval_key IS NOT NULL AND r.kind <> 'note'
      AND (
        r.user_id = ${viewer.userId}
        OR (en.status <> 'withdrawn' AND (r.visibility = 'circle' OR (r.visibility = 'guide' AND ${guideOk})))
      )
    ORDER BY r.created_at DESC LIMIT 800
  `;
  const mineKeys = new Set(rows.filter((r) => r.user_id === viewer.userId).map((r) => r.interval_key));
  const entered: Record<string, number> = {};
  const shown = rows.filter((r) => {
    if (r.user_id === viewer.userId) return true;
    entered[r.interval_key] = (entered[r.interval_key] ?? 0) + 1;
    if (isGuide) return true;
    const st = intervalState(sp, r.interval_key, now, tz);
    if (st === 'future') return false;
    if (curKey !== null && r.interval_key === curKey) return session.readFirst || mineKeys.has(r.interval_key);
    return true;
  });
  const comments = await commentsFor(shown.map((r) => r.id), run.id, viewer.userId);
  const entries = shown.map((r): OngoingEntry => {
    const mine = r.user_id === viewer.userId;
    return {
      id: r.id, intervalKey: r.interval_key, kind: r.kind, body: r.body, visibility: r.visibility, createdAt: r.created_at, updatedAt: r.updated_at,
      mine, authorKey: mine ? 'viewer' : r.author_guide ? r.user_id : r.enrolment_id, authorName: r.author_name ?? 'Someone', authorIsGuide: r.author_guide,
      comments: comments.get(r.id) ?? [],
    };
  });
  return { moduleId, tz, today, closesAt, plans, entries, entered, commentsMode: (await commentsTableExists()) ? 'everyone' : 'guide', isGuide };
}

export type SaveIntervalResult = { ok: true; view: OngoingView; key: string } | { ok: false; error: string };

/**
 * Keep this reader's entry for an interval, or change it. One entry per person per interval; a second save edits the first in place.
 * The server decides which interval it is, on the WRITER'S clock and zone (`now` and `tz`), and refuses a closed or future one.
 * A seated participant writes, and so does a guide NAMED on the run (seated through the engine on the first write). Org staff and admins who are not named stay readers.
 */
export async function saveIntervalEntry(
  viewer: LmsViewer, courseSlug: string, moduleId: string,
  input: { body: string; minutes?: number; visibility?: ResponseVisibility; key?: string; tz?: string | null },
  now: Date = new Date(),
): Promise<SaveIntervalResult> {
  if (!viewer.userId || !(await ongoingAvailable())) return { ok: false, error: 'Not available.' };
  const d = await doingFor(viewer, courseSlug, { seat: true });
  if (!d || !d.view.run || !d.view.published) return { ok: false, error: 'This workspace is read only for you.' };
  const run = d.view.run;
  const session = (await listOngoingSessions(run.id)).find((s) => s.moduleId === moduleId);
  if (!session) return { ok: false, error: 'That session is not ongoing.' };
  const sp = spec(session);
  const step = d.view.published.steps.find((s) => s.stepId === session.stepId);
  if (!step) return { ok: false, error: 'That session has no step yet.' };

  const [seat] = await db<Array<{ tz: string | null }>>`SELECT tz FROM lms_enrolments WHERE id = ${d.doing.enrolmentId}`;
  const tz = validTz(seat?.tz ?? input.tz);
  if (seat && !seat.tz && input.tz && validTz(input.tz) === input.tz) await db`UPDATE lms_enrolments SET tz = ${input.tz} WHERE id = ${d.doing.enrolmentId}`;

  const cur = currentInterval(sp, now, tz);
  const key = input.key ?? (cur.state === 'running' ? cur.key : '');
  if (!key) return { ok: false, error: cur.state === 'before' ? `This session opens on ${cur.opensOn}.` : 'This session has ended.' };
  const state = intervalState(sp, key, now, tz);
  if (state === 'invalid') return { ok: false, error: 'That is not one of this session’s days.' };
  if (state === 'future') return { ok: false, error: 'That day has not opened yet.' };
  if (state === 'closed') return { ok: false, error: 'That day has closed. The next one opens when it starts.' };

  const kind: 'reflection' | 'practice_log' = step.type === 'practice' ? 'practice_log' : 'reflection';
  const text = (input.body ?? '').trim();
  let body = text;
  if (kind === 'practice_log') {
    const minutes = Math.round(Number(input.minutes));
    if (!(minutes > 0)) return { ok: false, error: 'How many minutes did you practise?' };
    body = `${minutes} minutes.${text ? ` ${text}` : ''}`;
  }
  if (!body) return { ok: false, error: 'There’s nothing written yet.' };
  if (body.length > 20_000) return { ok: false, error: 'That’s longer than this box can keep.' };
  const vis: ResponseVisibility = input.visibility && d.doing.visChoices.includes(input.visibility as never) ? input.visibility : d.doing.defaultVisibility;
  if (vis === 'guide' && !d.doing.visChoices.includes('guide')) return { ok: false, error: 'No guide has been named for this group yet.' };

  const [have] = await db<Array<{ id: string }>>`
    SELECT id FROM lms_responses WHERE enrolment_id = ${d.doing.enrolmentId} AND step_id = ${session.stepId} AND interval_key = ${key} AND kind <> 'note'
  `;
  await db.begin(async (tx) => {
    if (have) {
      await tx`UPDATE lms_responses SET body = ${body}, visibility = ${vis}, updated_at = ${now} WHERE id = ${have.id} AND user_id = ${viewer.userId}`;
    } else {
      const id = newId();
      await tx`
        INSERT INTO lms_responses (id, enrolment_id, run_id, step_id, step_version_id, user_id, org_id, kind, body, visibility, interval_key, created_at, updated_at)
        VALUES (${id}, ${d.doing.enrolmentId}, ${run.id}, ${session.stepId}, ${step.stepVersionId}, ${viewer.userId}, ${run.orgId}, ${kind}, ${body}, ${vis}, ${key}, ${now}, ${now})
      `;
      await tx`INSERT INTO lms_events (org_id, actor_id, verb, object_type, object_id, object_version_id, enrolment_id, result)
               VALUES (${run.orgId}, ${viewer.userId}, 'responded', 'step', ${session.stepId}, ${step.stepVersionId}, ${d.doing.enrolmentId}, ${tx.json({ kind, visibility: vis, interval: key } as never)})`;
    }
  });
  const v = await getOngoingView(viewer, courseSlug, moduleId, tz, now);
  return v ? { ok: true, view: v, key } : { ok: false, error: 'Saved, but the session could not be refreshed.' };
}

/** The next interval's first day, for "the next one opens …". */
export const nextIntervalKey = (everyDays: number, key: string): string => addDaysKey(key, everyDays);

/** Turn an ongoing session off again (its cadence and planned material go; entries already written stay). Staff of the run only. */
export async function deleteOngoingSession(viewer: LmsViewer, runId: string, moduleId: string): Promise<WriteResult> {
  if (!(await ongoingAvailable())) return { ok: true };
  const run = await getRun(runId);
  if (!run || !(await isRunStaff(viewer, run))) return { ok: false, error: 'Guides only.' };
  await db`DELETE FROM workspace_materials WHERE host_type = 'lms_run' AND host_id = ${runId} AND scope_key = ${moduleId}`;
  await db`DELETE FROM workspace_cadences WHERE host_type = 'lms_run' AND host_id = ${runId} AND scope_key = ${moduleId}`;
  return { ok: true };
}
