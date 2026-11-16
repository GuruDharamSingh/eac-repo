/**
 * The dock's current-step store (L5, 2026-11-16; migration 275 `lms_dock_state`): one row per person
 * holding the trail they chose, where "Take me there" left from (the return ticket), and the last
 * step the completion hook ticked. A convenience over the LMS outline, which stays the truth.
 *
 * Every function tolerates the table being absent (42P01: one warning, then it answers as if there
 * were no row for ten minutes) and never throws, like the audit row in run.ts.
 */
import { db } from '@elkdonis/db';
import { randomBytes } from 'node:crypto';

export interface DockState {
  courseSlug: string | null;
  stepSlug: string | null;
  departedFrom: string | null;
  /** Null once older than two hours: a stale departure is ignored. */
  ticket: string | null;
  doneCourseSlug: string | null;
  doneStepSlug: string | null;
  /** Set only while the Done card is waiting to be shown (under 30 minutes old, not yet seen). */
  donePending: boolean;
}

const AWAY_MS = 2 * 60 * 60 * 1000;
const DONE_MS = 30 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000;
let missingAt = 0;

async function guard<T>(what: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  if (missingAt && Date.now() - missingAt < RETRY_MS) return fallback;
  try {
    return await fn();
  } catch (err) {
    if ((err as { code?: string })?.code === '42P01') {
      if (!missingAt) console.warn('[actions] lms_dock_state is missing (migration 275 not applied); the dock falls back to the LMS outline.');
      missingAt = Date.now();
    } else {
      console.error('[actions] dock state', what, err);
    }
    return fallback;
  }
}

/** A path on this host: starts with one slash, no second slash or backslash, no control characters. */
export function isLocalPath(p: unknown): p is string {
  return typeof p === 'string' && p.length > 0 && p.length <= 600 && /^\/(?!\/)/.test(p) && !/[\\\u0000-\u001f]/.test(p);
}

const slugOk = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(s);

export async function readDockState(userId: string): Promise<DockState | null> {
  return guard('read', null, async () => {
    const [r] = await db<Array<{
      course_slug: string | null; step_slug: string | null; departed_from: string | null; departed_at: Date | null; ticket: string | null;
      done_course_slug: string | null; done_step_slug: string | null; done_at: Date | null; done_seen_at: Date | null;
    }>>`SELECT course_slug, step_slug, departed_from, departed_at, ticket, done_course_slug, done_step_slug, done_at, done_seen_at FROM lms_dock_state WHERE user_id = ${userId}`;
    if (!r) return null;
    const away = r.departed_from && r.ticket && r.departed_at && Date.now() - r.departed_at.getTime() < AWAY_MS;
    return {
      courseSlug: r.course_slug,
      stepSlug: r.step_slug,
      departedFrom: away ? r.departed_from : null,
      ticket: away ? r.ticket : null,
      doneCourseSlug: r.done_course_slug,
      doneStepSlug: r.done_step_slug,
      donePending: Boolean(r.done_at && !r.done_seen_at && Date.now() - r.done_at.getTime() < DONE_MS),
    };
  });
}

/** Remember the step the dock settled on (best effort). Changing step clears nothing else. */
export async function writeDockStep(userId: string, courseSlug: string, stepSlug: string): Promise<void> {
  if (!slugOk(courseSlug) || !slugOk(stepSlug)) return;
  await guard('step', undefined, async () => {
    await db`
      INSERT INTO lms_dock_state (user_id, course_slug, step_slug) VALUES (${userId}, ${courseSlug}, ${stepSlug})
      ON CONFLICT (user_id) DO UPDATE SET course_slug = EXCLUDED.course_slug, step_slug = EXCLUDED.step_slug, updated_at = NOW()
    `;
  });
}

/** "Take me there": record where to come back to. Returns the ticket, or null when it could not be kept. */
export async function dockDepart(userId: string, input: { courseSlug: string; stepSlug: string; returnPath: string }): Promise<string | null> {
  if (!slugOk(input.courseSlug) || !slugOk(input.stepSlug) || !isLocalPath(input.returnPath)) return null;
  const ticket = randomBytes(6).toString('base64url');
  return guard('depart', null, async () => {
    await db`
      INSERT INTO lms_dock_state (user_id, course_slug, step_slug, departed_from, departed_at, ticket)
      VALUES (${userId}, ${input.courseSlug}, ${input.stepSlug}, ${input.returnPath}, NOW(), ${ticket})
      ON CONFLICT (user_id) DO UPDATE SET course_slug = EXCLUDED.course_slug, step_slug = EXCLUDED.step_slug,
        departed_from = EXCLUDED.departed_from, departed_at = NOW(), ticket = EXCLUDED.ticket, updated_at = NOW()
    `;
    return ticket;
  });
}

/** "Back to the trail": clear the departure and return the path to go back to (null when not away). */
export async function dockReturn(userId: string): Promise<string | null> {
  return guard('return', null, async () => {
    const [r] = await db<Array<{ departed_from: string | null; departed_at: Date | null }>>`
      UPDATE lms_dock_state x SET departed_from = NULL, ticket = NULL, departed_at = NULL, updated_at = NOW()
      FROM (SELECT departed_from, departed_at FROM lms_dock_state WHERE user_id = ${userId} FOR UPDATE) o
      WHERE x.user_id = ${userId}
      RETURNING o.departed_from, o.departed_at
    `;
    if (!r?.departed_from || !isLocalPath(r.departed_from)) return null;
    return r.departed_at && Date.now() - r.departed_at.getTime() < AWAY_MS ? r.departed_from : null;
  });
}

/**
 * A step was ticked on the person's trail: show the Done card once. The completion hook overwrites
 * (it ticked what they just did); the dock's own re-check passes `keep`, so a tick it finds on the
 * side never replaces a card still waiting to be seen.
 */
export async function dockMarkDone(userId: string, courseSlug: string, stepSlug: string, opts: { keep?: boolean } = {}): Promise<void> {
  if (!slugOk(courseSlug) || !slugOk(stepSlug)) return;
  await guard('done', undefined, async () => {
    await db`
      INSERT INTO lms_dock_state (user_id, done_course_slug, done_step_slug, done_at, done_seen_at) VALUES (${userId}, ${courseSlug}, ${stepSlug}, NOW(), NULL)
      ON CONFLICT (user_id) DO UPDATE SET done_course_slug = EXCLUDED.done_course_slug, done_step_slug = EXCLUDED.done_step_slug,
        done_at = NOW(), done_seen_at = NULL, updated_at = NOW()
      ${opts.keep
        ? db`WHERE lms_dock_state.done_at IS NULL OR lms_dock_state.done_seen_at IS NOT NULL OR lms_dock_state.done_at < NOW() - INTERVAL '30 minutes'`
        : db``}
    `;
  });
}

export async function dockMarkDoneSeen(userId: string): Promise<void> {
  await guard('done-seen', undefined, async () => {
    await db`UPDATE lms_dock_state SET done_seen_at = NOW(), updated_at = NOW() WHERE user_id = ${userId} AND done_seen_at IS NULL`;
  });
}

/** The picker: choose a trail. The step is cleared so the dock finds the first open one. */
export async function dockChoose(userId: string, courseSlug: string): Promise<void> {
  if (!slugOk(courseSlug)) return;
  await guard('choose', undefined, async () => {
    await db`
      INSERT INTO lms_dock_state (user_id, course_slug, step_slug) VALUES (${userId}, ${courseSlug}, NULL)
      ON CONFLICT (user_id) DO UPDATE SET course_slug = EXCLUDED.course_slug, step_slug = NULL, updated_at = NOW()
    `;
  });
}
