import { db } from '@elkdonis/db';
import { davList, davMkcol, davMove } from './dav';
import { occurrencesOf } from './meeting-rota';
import { circleMeta, circleOccurrenceNumber, circleSessionFolderName, CIRCLE_RECORDINGS } from './reading-circle';

// ============================================================================
// Reading circles: record the call automatically, and file the recording.
//
// Talk (spreed 23) facts this relies on, read from its source on 2026-09-26:
//   - POST /ocs/v2.php/apps/spreed/api/v1/recording/{token} {status: 1|2}
//     starts a video (1) or audio (2) recording. The caller must be a
//     logged-in MODERATOR of the room; they need not be in the call. The call
//     must be active and no recording already running.
//   - The finished file is stored in the home of whoever started it, under
//     <attachment folder>/Recording/<token>/ — for the service account,
//     Talk/Recording/<token>/.
//
// So: during a circle's session window, once two or more people are in the
// call, the service account (the owner of every circle room the site made)
// starts a video recording. Afterwards the file is moved from the service
// account's Talk/Recording/<token>/ into the circle's session folder,
//   <org root>/Private/Circles/<circle>/Meeting Recordings/<date> Session NN/
// which the circle page lists. A recording someone starts by hand stays in
// their own Talk folder; this only files what the service account recorded.
//
// Consent: the owner chose a notice on the circle page (2026-09-26), not
// Talk's consent prompt.
// ============================================================================

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL;
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER || '';
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD || '';

/** Window around a sitting in which to watch the call. */
const BEFORE_MS = 10 * 60 * 1000;
const AFTER_MS = 30 * 60 * 1000;
/** A file must be unchanged this long before it is moved (the upload has finished). */
const SETTLE_MS = 3 * 60 * 1000;

// Talk's Room::RECORDING_* values.
const RECORDING_NONE = 0;
const RECORDING_FAILED = 5;
const RECORDING_VIDEO = 1;

async function ocs<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<{ status: number; data: T | null }> {
  if (!NEXTCLOUD_URL || !NEXTCLOUD_USER) return { status: 0, data: null };
  const auth = Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}`).toString('base64');
  const res = await fetch(`${NEXTCLOUD_URL}/ocs/v2.php/apps/spreed/api/${path}${path.includes('?') ? '&' : '?'}format=json`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      'OCS-APIRequest': 'true',
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json().catch(() => null)) as { ocs?: { data?: T } } | null;
  return { status: res.status, data: json?.ocs?.data ?? null };
}

interface CircleRow {
  id: string;
  org_id: string;
  title: string;
  slug: string | null;
  nextcloud_talk_token: string;
  scheduled_at: Date | null;
  recurrence_pattern: string | null;
  recurrence_until: Date | null;
  duration_minutes: number | null;
  metadata: Record<string, unknown> | null;
}

async function listCircles(orgId?: string): Promise<CircleRow[]> {
  return db<CircleRow[]>`
    SELECT id, org_id, title, slug, nextcloud_talk_token, scheduled_at, recurrence_pattern,
           recurrence_until, duration_minutes, metadata
    FROM threads
    WHERE kind = 'reading_group' AND status = 'published'
      AND nextcloud_talk_token IS NOT NULL
      ${orgId ? db`AND org_id = ${orgId}` : db``}
  `;
}

function meetingOf(c: CircleRow) {
  return { scheduledAt: c.scheduled_at, recurrencePattern: c.recurrence_pattern, recurrenceUntil: c.recurrence_until };
}

/** The sitting whose window contains `now`, if any. */
function sittingNow(c: CircleRow, now: number): Date | null {
  if (!c.scheduled_at) return null;
  const dur = (c.duration_minutes ?? 60) * 60_000;
  const [at] = occurrencesOf(meetingOf(c), { from: new Date(now - dur - AFTER_MS), count: 1 });
  if (!at) return null;
  return now >= at.getTime() - BEFORE_MS && now <= at.getTime() + dur + AFTER_MS ? at : null;
}

export interface CircleRecordingReport {
  watched: number;
  started: string[];
  filed: string[];
  errors: string[];
}

/**
 * One pass: start recordings where two or more people are in a circle's call
 * during its session window. Safe to run every 30 seconds.
 */
export async function runCircleRecordingTick(orgId?: string): Promise<CircleRecordingReport> {
  const report: CircleRecordingReport = { watched: 0, started: [], filed: [], errors: [] };
  const now = Date.now();
  for (const c of await listCircles(orgId)) {
    if (!sittingNow(c, now)) continue;
    report.watched++;
    try {
      const room = await ocs<{ callRecording?: number; hasCall?: boolean }>('GET', `v4/room/${c.nextcloud_talk_token}`);
      if (!room.data?.hasCall) continue;
      const rec = room.data.callRecording ?? RECORDING_NONE;
      if (rec !== RECORDING_NONE && rec !== RECORDING_FAILED) continue;

      const people = await ocs<Array<{ actorType: string; actorId: string; inCall: number }>>(
        'GET',
        `v4/room/${c.nextcloud_talk_token}/participants`
      );
      const inCall = (people.data ?? []).filter(
        (p) => p.inCall > 0 && !(p.actorType === 'users' && p.actorId === NEXTCLOUD_USER)
      ).length;
      if (inCall < 2) continue;

      const started = await ocs('POST', `v1/recording/${c.nextcloud_talk_token}`, { status: RECORDING_VIDEO });
      if (started.status === 200) {
        report.started.push(`${c.title} (${inCall} in call)`);
      } else {
        report.errors.push(`${c.title}: start recording -> HTTP ${started.status}`);
      }
    } catch (err) {
      report.errors.push(`${c.title}: ${(err as Error).message}`);
    }
  }
  return report;
}

/**
 * Move the service account's finished recordings of circle rooms into each
 * circle's session folder. The sitting is the latest one that started before
 * the file was last written, within 12 hours.
 */
export async function fileCircleRecordings(orgId?: string, timeZone = 'UTC'): Promise<CircleRecordingReport> {
  const report: CircleRecordingReport = { watched: 0, started: [], filed: [], errors: [] };
  const now = Date.now();
  for (const c of await listCircles(orgId)) {
    const folder = circleMeta(c.metadata).folder;
    if (!folder || !c.scheduled_at) continue;
    const files = (await davList(`Talk/Recording/${c.nextcloud_talk_token}`).catch(() => [])).filter((f) => !f.isFolder);
    report.watched += files.length;
    for (const f of files) {
      const written = f.lastModified ? new Date(f.lastModified).getTime() : NaN;
      if (!Number.isFinite(written) || now - written < SETTLE_MS) continue;
      const recent = occurrencesOf(meetingOf(c), { from: new Date(written - 12 * 3_600_000), count: 20 })
        .filter((d) => d.getTime() - BEFORE_MS <= written);
      const at = recent.at(-1);
      if (!at) {
        report.errors.push(`${c.title}: no sitting for ${f.name}`);
        continue;
      }
      const number = circleOccurrenceNumber(meetingOf(c), at);
      const root = `EAC_Network/${c.org_id}/${folder}/${CIRCLE_RECORDINGS}`;
      const target = `${root}/${circleSessionFolderName(at, number, timeZone)}`;
      await davMkcol(root).catch(() => false);
      await davMkcol(target).catch(() => false);
      if (await davMove(f.path, `${target}/${f.name}`)) {
        report.filed.push(`${c.title}: ${f.name} -> ${target}`);
      } else {
        report.errors.push(`${c.title}: could not move ${f.name}`);
      }
    }
  }
  return report;
}
