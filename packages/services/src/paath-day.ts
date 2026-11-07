/**
 * The Akhand Path's day, read-only, for the routine that walks its readers
 * through it (docs/open/DAILY_ROUTINE_BRIEF_2026-11-06.md §3.2). The reading
 * itself lives in apps/fourthwayBookreaders (src/lib/paath.ts); this module
 * answers "what of today is done?" from the same rows, for any host, so the
 * action registry (packages/actions) can tick the four daily steps:
 *
 *   read     circle_units done in the day's range (site zone) ≥ the day's target
 *   record   a recording of the day: a video_uploads row for a file in the day
 *            folder, else a file in <folder>/Meeting Recordings/<day> Day N/
 *   note     the day's meeting_occurrence_notes row has a note or a stop point
 *   send     the day's upload is published (queued/uploading: under way)
 *
 * Who may see it: the thread's author and readers with a `yes` RSVP; when the
 * thread is PUBLIC, anyone with a role in its org (paath.ts canReadPaath).
 * Never writes.
 */

import { db } from '@elkdonis/db';
import { listOrgFiles } from './org-storage';

export const PAATH_ORG_ID = 'fourth_way_book_readers';
export const PAATH_SLUG = 'akhand-path';
/** fourthwayBookreaders' siteConfig.timeZone. */
export const PAATH_ZONE = 'America/Toronto';
const RECORDINGS = 'Meeting Recordings';

export interface PaathDayCircle {
  id: string;
  orgId: string;
  authorId: string;
  isPrivate: boolean;
  folder: string;
  startedOn: string;
  /** Passages a day (metadata.paath.dailyTarget), default 1. */
  dailyTarget: number;
}

export interface PaathDayStatus {
  circle: PaathDayCircle;
  day: string;
  dayNumber: number;
  read: { done: number; target: number };
  record: { files: number };
  note: { written: boolean };
  /** video_uploads by state (youtube-uploads.ts VideoUploadStatus); failed counts as awaiting a retry. */
  send: { done: number; pending: number; awaiting: number };
}

// ── Days in a zone ──────────────────────────────────────────────────────────

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isPaathDay = (s: unknown): s is string => typeof s === 'string' && DAY.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));

/** Today (YYYY-MM-DD) in `zone`. */
export function dayIn(zone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

function zoneOffsetMs(zone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')) - at.getTime();
}

/** Midnight at the start of `day` in `zone` (paath.ts dayStart, same arithmetic). */
export function zonedMidnight(day: string, zone: string): Date {
  const asIfUtc = new Date(`${day}T00:00:00Z`);
  const guess = new Date(asIfUtc.getTime() - zoneOffsetMs(zone, asIfUtc));
  return new Date(asIfUtc.getTime() - zoneOffsetMs(zone, guess));
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function paathDayNumber(circle: Pick<PaathDayCircle, 'startedOn'>, day: string): number {
  return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${circle.startedOn}T12:00:00Z`)) / 86_400_000) + 1;
}

// ── The circle and its readers ─────────────────────────────────────────────

export async function getPaathDayCircle(): Promise<PaathDayCircle | null> {
  const [row] = await db<Array<{ id: string; author_id: string; visibility: string; metadata: Record<string, any> | null }>>`
    SELECT id, author_id, visibility, metadata FROM threads
    WHERE org_id = ${PAATH_ORG_ID} AND kind = 'reading_group' AND slug = ${PAATH_SLUG} AND status = 'published'
    LIMIT 1
  `;
  if (!row) return null;
  const paath = (row.metadata?.paath ?? {}) as Record<string, unknown>;
  const target = Number(paath.dailyTarget);
  return {
    id: row.id,
    orgId: PAATH_ORG_ID,
    authorId: row.author_id,
    isPrivate: row.visibility !== 'PUBLIC',
    folder: typeof row.metadata?.circle?.folder === 'string' ? row.metadata.circle.folder : `Private/Circles/${PAATH_SLUG}`,
    startedOn: isPaathDay(paath.startedOn) ? paath.startedOn : dayIn(PAATH_ZONE),
    dailyTarget: Number.isInteger(target) && target > 0 ? Math.min(target, 500) : 1,
  };
}

/** paath.ts canReadPaath, for a user id. */
export async function isPaathReader(circle: PaathDayCircle, userId: string): Promise<boolean> {
  if (userId === circle.authorId) return true;
  const [rsvp] = await db<{ status: string }[]>`
    SELECT status FROM thread_rsvps WHERE thread_id = ${circle.id} AND user_id = ${userId}
  `;
  if (rsvp?.status === 'yes') return true;
  if (circle.isPrivate) return false;
  const [role] = await db<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM user_organizations WHERE org_id = ${circle.orgId} AND user_id = ${userId}
  `;
  return Boolean(role?.n);
}

// ── A day ───────────────────────────────────────────────────────────────────

/**
 * What of `day` (default today in the site's zone) is done. Null when there
 * is no reading or the user is not one of its readers. A day before the
 * reading began is reported as day 0 with nothing to do.
 */
export async function getPaathDayStatus(userId: string, day?: string | null): Promise<PaathDayStatus | null> {
  const circle = await getPaathDayCircle();
  if (!circle || !(await isPaathReader(circle, userId))) return null;
  const d = isPaathDay(day) ? day : dayIn(PAATH_ZONE);
  const from = zonedMidnight(d, PAATH_ZONE);
  const to = zonedMidnight(addDays(d, 1), PAATH_ZONE);
  const dayNumber = paathDayNumber(circle, d);
  const folderName = `${d} Day ${dayNumber}`;
  // Source paths are org-root paths ending in …/Meeting Recordings/<day> Day N/<file>.
  const pathLike = `%/${RECORDINGS}/${d} %/%`;

  const [[read], [note], uploads] = await Promise.all([
    db<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM circle_units
      WHERE thread_id = ${circle.id} AND status = 'done' AND done_at >= ${from} AND done_at < ${to}
    `,
    db<{ written: boolean }[]>`
      SELECT (coalesce(btrim(note), '') <> '' OR stop_unit_id IS NOT NULL) AS written
      FROM meeting_occurrence_notes WHERE thread_id = ${circle.id} AND occurrence_at = ${from}
    `,
    db<{ status: string; n: number }[]>`
      SELECT status, COUNT(*)::int AS n FROM video_uploads
      WHERE org_id = ${circle.orgId} AND thread_id = ${circle.id} AND source_path LIKE ${pathLike}
      GROUP BY status
    `,
  ]);
  const count = (...s: string[]) => uploads.filter((u) => s.includes(u.status)).reduce((a, u) => a + u.n, 0);
  let files = uploads.reduce((a, u) => a + u.n, 0);
  if (files === 0) {
    // No upload row (no publish target, or the scanner has not run yet): look in the folder.
    const listed = await listOrgFiles(circle.orgId, `${circle.folder}/${RECORDINGS}/${folderName}`).catch(() => []);
    files = listed.filter((f) => !f.isFolder).length;
  }
  return {
    circle,
    day: d,
    dayNumber,
    read: { done: read?.n ?? 0, target: circle.dailyTarget },
    record: { files },
    note: { written: Boolean(note?.written) },
    send: { done: count('published'), pending: count('queued', 'uploading'), awaiting: count('awaiting', 'failed') },
  };
}
