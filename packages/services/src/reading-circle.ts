import { db } from '@elkdonis/db';
import { createCollaborativeDocument, createTalkRoom } from './nextcloud';
import { createThread } from './posts';
import { gatherOnto } from './gather';
import { createOrgFolder } from './org-storage';
import { getOrgFeed, upsertOrgFeed } from './org-feeds';
import { occurrencesOf } from './meeting-rota';

// ============================================================================
// Reading circles (migration 165).
//
// A circle is a scheduled thread (apps/fourthwayBookreaders: kind
// `reading_group`). Its sittings are the thread's occurrences; what happened
// at one is the `meeting_occurrence_notes` row IFAC and InnerGathering already
// keep (note, attendance, plan). This module adds the two things a reading
// circle needs beyond a standing meeting:
//
//   the plan    `circle_units`: the material in reading order — issues,
//               chapters, tracks — each with a length in pages or seconds and
//               an optional target date.
//   the stop    `meeting_occurrence_notes.stop_unit_id / stop_position`: where
//               a sitting ended. The next sitting starts from the latest one.
//
// Plus the circle's own space: a folder under the org's Private/ tree, a Talk
// room, and a members-only discussion feed.
//
// Every function takes the org id and scopes by it. Callers authorise: the
// service account behind Nextcloud and the database role can reach every org.
// ============================================================================

/** Vocabularies. Kept here, not in CHECK constraints (see migration 165). */
export const CIRCLE_UNIT_KINDS = ['document', 'chapter', 'audio', 'video'] as const;
export type CircleUnitKind = (typeof CIRCLE_UNIT_KINDS)[number];
export const CIRCLE_UNIT_STATUSES = ['planned', 'open', 'done', 'skipped'] as const;
export type CircleUnitStatus = (typeof CIRCLE_UNIT_STATUSES)[number];
export type CircleLengthUnit = 'pages' | 'seconds';

export interface CircleUnit {
  id: string;
  position: number;
  title: string;
  /** Short handle, e.g. "TOTM 12" or "Ch. 3". */
  label: string | null;
  kind: CircleUnitKind;
  /** Relative to the org's storage root (e.g. Private/Circles/totm/Material/totm012.pdf). */
  sourcePath: string | null;
  length: number | null;
  lengthUnit: CircleLengthUnit;
  /** YYYY-MM-DD: the sitting this unit was planned for, when a baseline was set. */
  targetOn: string | null;
  status: CircleUnitStatus;
  doneAt: string | null;
}

export interface NewCircleUnit {
  title: string;
  label?: string | null;
  kind?: CircleUnitKind;
  sourcePath?: string | null;
  length?: number | null;
  lengthUnit?: CircleLengthUnit;
  targetOn?: string | null;
}

export interface CircleSession {
  /** ISO timestamp of the occurrence. */
  occurrenceAt: string;
  plan: string | null;
  note: string | null;
  stopUnitId: string | null;
  stopPosition: number | null;
  recordedBy: string | null;
  updatedAt: string | null;
}

/** Where the next sitting starts. */
export interface CircleResume {
  unit: CircleUnit;
  /** Page or second within the unit; 1 / 0 for "from the start". */
  position: number;
  /** The sitting that recorded the stop, or null when nothing has been recorded yet. */
  fromOccurrenceAt: string | null;
}

interface UnitRow {
  id: string;
  position: number;
  title: string;
  label: string | null;
  kind: string;
  source_path: string | null;
  length: number | null;
  length_unit: string;
  target_on: string | Date | null;
  status: string;
  done_at: string | Date | null;
}

const UNIT_COLUMNS = db`
  id, position, title, label, kind, source_path, length, length_unit,
  target_on, status, done_at
`;

function day(value: string | Date | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  // DATE columns arrive as a Date at UTC midnight.
  return value.toISOString().slice(0, 10);
}

function mapUnit(r: UnitRow): CircleUnit {
  return {
    id: r.id,
    position: r.position,
    title: r.title,
    label: r.label,
    kind: (CIRCLE_UNIT_KINDS as readonly string[]).includes(r.kind) ? (r.kind as CircleUnitKind) : 'document',
    sourcePath: r.source_path,
    length: r.length,
    lengthUnit: r.length_unit === 'seconds' ? 'seconds' : 'pages',
    targetOn: day(r.target_on),
    status: (CIRCLE_UNIT_STATUSES as readonly string[]).includes(r.status) ? (r.status as CircleUnitStatus) : 'planned',
    doneAt: r.done_at ? new Date(r.done_at).toISOString() : null,
  };
}

/** The circle thread, if it is this org's. Every write below starts here. */
async function circleThread(orgId: string, threadId: string) {
  const [row] = await db<
    Array<{
      id: string;
      slug: string | null;
      title: string;
      scheduled_at: Date | null;
      recurrence_pattern: string | null;
      recurrence_until: Date | null;
      nextcloud_talk_token: string | null;
      author_id: string | null;
      metadata: Record<string, unknown> | null;
    }>
  >`
    SELECT id, slug, title, scheduled_at, recurrence_pattern, recurrence_until,
           nextcloud_talk_token, author_id, metadata
    FROM threads WHERE id = ${threadId} AND org_id = ${orgId}
  `;
  return row ?? null;
}

// ── The plan ────────────────────────────────────────────────────────────────

export async function listCircleUnits(orgId: string, threadId: string): Promise<CircleUnit[]> {
  const rows = await db<UnitRow[]>`
    SELECT ${UNIT_COLUMNS} FROM circle_units
    WHERE org_id = ${orgId} AND thread_id = ${threadId}
    ORDER BY position, created_at
  `;
  return rows.map(mapUnit);
}

/** Append units after the last one. Returns how many were added. */
export async function addCircleUnits(
  orgId: string,
  threadId: string,
  units: NewCircleUnit[]
): Promise<number> {
  if (units.length === 0) return 0;
  if (!(await circleThread(orgId, threadId))) throw new Error('Circle not found');

  const [{ max }] = await db<{ max: number | null }[]>`
    SELECT MAX(position) AS max FROM circle_units WHERE thread_id = ${threadId}
  `;
  let position = max ?? 0;
  const rows = units
    .filter((u) => u.title.trim())
    .map((u) => ({
      org_id: orgId,
      thread_id: threadId,
      position: ++position,
      title: u.title.trim().slice(0, 300),
      label: u.label?.trim().slice(0, 60) || null,
      kind: u.kind && CIRCLE_UNIT_KINDS.includes(u.kind) ? u.kind : 'document',
      source_path: u.sourcePath?.replace(/^\/+/, '') || null,
      length: u.length != null && u.length > 0 ? Math.round(u.length) : null,
      length_unit: u.lengthUnit === 'seconds' ? 'seconds' : 'pages',
      target_on: u.targetOn || null,
    }));
  if (rows.length === 0) return 0;
  await db`INSERT INTO circle_units ${db(rows as never)}`;
  return rows.length;
}

export async function updateCircleUnit(
  orgId: string,
  threadId: string,
  unitId: string,
  patch: Partial<Pick<CircleUnit, 'title' | 'label' | 'sourcePath' | 'length' | 'targetOn' | 'status'>>
): Promise<void> {
  const status =
    patch.status && CIRCLE_UNIT_STATUSES.includes(patch.status) ? patch.status : undefined;
  await db`
    UPDATE circle_units SET
      title       = COALESCE(${patch.title?.trim() || null}, title),
      label       = CASE WHEN ${patch.label !== undefined} THEN ${patch.label?.trim() || null} ELSE label END,
      source_path = CASE WHEN ${patch.sourcePath !== undefined} THEN ${patch.sourcePath?.replace(/^\/+/, '') || null} ELSE source_path END,
      length      = CASE WHEN ${patch.length !== undefined} THEN ${patch.length ?? null}::int ELSE length END,
      target_on   = CASE WHEN ${patch.targetOn !== undefined} THEN ${patch.targetOn || null}::date ELSE target_on END,
      status      = COALESCE(${status ?? null}, status),
      done_at     = CASE WHEN ${status ?? null}::text = 'done' THEN COALESCE(done_at, NOW())
                         WHEN ${status ?? null}::text IS NOT NULL THEN NULL
                         ELSE done_at END,
      updated_at  = NOW()
    WHERE id = ${unitId} AND thread_id = ${threadId} AND org_id = ${orgId}
  `;
}

export async function removeCircleUnit(orgId: string, threadId: string, unitId: string): Promise<void> {
  await db`DELETE FROM circle_units WHERE id = ${unitId} AND thread_id = ${threadId} AND org_id = ${orgId}`;
}

/** Move a unit one place up or down by swapping positions with its neighbour. */
export async function moveCircleUnit(
  orgId: string,
  threadId: string,
  unitId: string,
  direction: 'up' | 'down'
): Promise<void> {
  const units = await listCircleUnits(orgId, threadId);
  const i = units.findIndex((u) => u.id === unitId);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= units.length) return;
  await db.begin(async (tx) => {
    await tx`UPDATE circle_units SET position = ${units[j].position}, updated_at = NOW() WHERE id = ${units[i].id}`;
    await tx`UPDATE circle_units SET position = ${units[i].position}, updated_at = NOW() WHERE id = ${units[j].id}`;
  });
}

// ── Sittings and the stop point ─────────────────────────────────────────────

export async function listCircleSessions(
  orgId: string,
  threadId: string,
  limit = 40
): Promise<CircleSession[]> {
  if (!(await circleThread(orgId, threadId))) return [];
  const rows = await db<
    Array<{
      occurrence_at: Date;
      plan: string | null;
      note: string | null;
      stop_unit_id: string | null;
      stop_position: number | null;
      recorded_by: string | null;
      updated_at: Date | null;
    }>
  >`
    SELECT occurrence_at, plan, note, stop_unit_id, stop_position, recorded_by, updated_at
    FROM meeting_occurrence_notes
    WHERE thread_id = ${threadId}
    ORDER BY occurrence_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    occurrenceAt: new Date(r.occurrence_at).toISOString(),
    plan: r.plan,
    note: r.note,
    stopUnitId: r.stop_unit_id,
    stopPosition: r.stop_position,
    recordedBy: r.recorded_by,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  }));
}

/**
 * Where the next sitting starts: the latest recorded stop, or — before any
 * sitting has recorded one — the first unit not yet done.
 */
export async function getCircleResume(
  orgId: string,
  threadId: string,
  units?: CircleUnit[]
): Promise<CircleResume | null> {
  const all = units ?? (await listCircleUnits(orgId, threadId));
  if (all.length === 0) return null;

  const [last] = await db<
    Array<{ occurrence_at: Date; stop_unit_id: string; stop_position: number | null }>
  >`
    SELECT occurrence_at, stop_unit_id, stop_position
    FROM meeting_occurrence_notes
    WHERE thread_id = ${threadId} AND stop_unit_id IS NOT NULL
    ORDER BY occurrence_at DESC
    LIMIT 1
  `;
  const firstOpen = all.find((u) => u.status !== 'done' && u.status !== 'skipped') ?? null;
  if (!last) {
    return firstOpen ? { unit: firstOpen, position: startOf(firstOpen), fromOccurrenceAt: null } : null;
  }

  const stopped = all.find((u) => u.id === last.stop_unit_id);
  const from = new Date(last.occurrence_at).toISOString();
  // The unit it stopped in was finished at that sitting (or since): start the
  // next open one. Otherwise pick up inside it.
  if (!stopped || stopped.status === 'done' || stopped.status === 'skipped') {
    return firstOpen ? { unit: firstOpen, position: startOf(firstOpen), fromOccurrenceAt: from } : null;
  }
  return { unit: stopped, position: last.stop_position ?? startOf(stopped), fromOccurrenceAt: from };
}

function startOf(unit: CircleUnit): number {
  return unit.lengthUnit === 'seconds' ? 0 : 1;
}

/** "p. 4" or "14:20" — a stop position as a reader says it. */
export function formatCirclePosition(position: number, unit: CircleLengthUnit): string {
  if (unit === 'seconds') {
    const h = Math.floor(position / 3600);
    const m = Math.floor((position % 3600) / 60);
    const s = position % 60;
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
  }
  return `p. ${position}`;
}

/** "14:20", "1:02:03" or "845" → seconds; null if unreadable. */
export function parseCirclePosition(input: string, unit: CircleLengthUnit): number | null {
  const v = input.trim();
  if (!v) return null;
  if (unit === 'pages') return /^\d+$/.test(v) ? Number(v) : null;
  if (/^\d+$/.test(v)) return Number(v);
  const parts = v.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

/**
 * Record where a sitting stopped.
 *
 * Every unit before the stop unit becomes done; the stop unit becomes done
 * when `finished`, otherwise open. The occurrence's note is written with it,
 * and the NEXT occurrence gets a plan line saying where it starts, unless a
 * plan was already written for it by hand.
 */
export async function recordCircleStop(input: {
  orgId: string;
  threadId: string;
  occurrenceAt: Date;
  unitId: string;
  position: number | null;
  finished: boolean;
  note: string | null;
  actorUserId: string;
}): Promise<void> {
  const thread = await circleThread(input.orgId, input.threadId);
  if (!thread) throw new Error('Circle not found');
  const units = await listCircleUnits(input.orgId, input.threadId);
  const idx = units.findIndex((u) => u.id === input.unitId);
  if (idx < 0) throw new Error('Unit not found');
  const unit = units[idx];
  const at = input.occurrenceAt.toISOString();
  const note = input.note?.trim() ? input.note.trim().slice(0, 20000) : null;

  const before = units.slice(0, idx).filter((u) => u.status !== 'done' && u.status !== 'skipped');

  await db.begin(async (tx) => {
    await tx`
      INSERT INTO meeting_occurrence_notes
        (thread_id, occurrence_at, note, recorded_by, stop_unit_id, stop_position)
      VALUES (${input.threadId}, ${at}::timestamptz, ${note}, ${input.actorUserId},
              ${unit.id}, ${input.position})
      ON CONFLICT (thread_id, occurrence_at) DO UPDATE
        SET note = COALESCE(EXCLUDED.note, meeting_occurrence_notes.note),
            recorded_by = EXCLUDED.recorded_by,
            stop_unit_id = EXCLUDED.stop_unit_id,
            stop_position = EXCLUDED.stop_position,
            updated_at = NOW()
    `;
    if (before.length > 0) {
      await tx`
        UPDATE circle_units SET status = 'done', done_at = COALESCE(done_at, ${at}::timestamptz), updated_at = NOW()
        WHERE id = ANY(${before.map((u) => u.id)}) AND org_id = ${input.orgId}
      `;
    }
    await tx`
      UPDATE circle_units
      SET status = ${input.finished ? 'done' : 'open'},
          done_at = ${input.finished ? at : null}::timestamptz,
          updated_at = NOW()
      WHERE id = ${unit.id} AND org_id = ${input.orgId}
    `;
  });

  // The next sitting's plan line, unless someone already wrote one.
  const [next] = occurrencesOf(
    {
      scheduledAt: thread.scheduled_at,
      recurrencePattern: thread.recurrence_pattern,
      recurrenceUntil: thread.recurrence_until,
    },
    { from: new Date(input.occurrenceAt.getTime() + 60_000), count: 1 }
  );
  if (!next) return;
  const resumeUnit = input.finished ? units.slice(idx + 1).find((u) => u.status !== 'done' && u.status !== 'skipped') : unit;
  if (!resumeUnit) return;
  const name = resumeUnit.label ? `${resumeUnit.label} — ${resumeUnit.title}` : resumeUnit.title;
  const plan = input.finished || input.position == null
    ? `Start ${name}`
    : `Continue ${name} from ${formatCirclePosition(input.position, unit.lengthUnit)}`;
  await db`
    INSERT INTO meeting_occurrence_notes (thread_id, occurrence_at, plan, planned_by, planned_at)
    VALUES (${input.threadId}, ${next.toISOString()}::timestamptz, ${plan}, ${input.actorUserId}, NOW())
    ON CONFLICT (thread_id, occurrence_at) DO UPDATE
      SET plan = COALESCE(meeting_occurrence_notes.plan, EXCLUDED.plan),
          planned_by = COALESCE(meeting_occurrence_notes.planned_by, EXCLUDED.planned_by),
          planned_at = COALESCE(meeting_occurrence_notes.planned_at, EXCLUDED.planned_at)
  `;
}

// ── The timeline ────────────────────────────────────────────────────────────

export interface CircleTimeline {
  /** Units per sitting the projection assumes. */
  pace: number;
  total: number;
  done: number;
  remaining: number;
  /** The next sittings and the units each is expected to cover. */
  upcoming: Array<{ at: string; units: CircleUnit[] }>;
  /** The sitting at which the last unit is expected to be finished, if the schedule reaches it. */
  projectedFinish: string | null;
  /** The baseline target of the last unit, if one was set. */
  plannedFinish: string | null;
  /**
   * Sittings behind (positive) or ahead (negative) of the baseline, judged by
   * the first open unit's target date against the next sitting. Null without
   * a baseline.
   */
  behindBy: number | null;
}

/**
 * Project the plan onto the circle's schedule.
 *
 * Pace is units per sitting. The unit a sitting stopped inside counts as a
 * whole unit for the next sitting — a half-read issue is the next thing read,
 * not half of a slot — which keeps the projection simple and slightly
 * pessimistic.
 */
export function projectCircleTimeline(
  units: CircleUnit[],
  meeting: {
    scheduledAt: Date | string | null;
    recurrencePattern: string | null;
    recurrenceUntil: Date | string | null;
  },
  options: { pace?: number; from?: Date; show?: number } = {}
): CircleTimeline {
  const pace = Math.max(1, Math.min(Math.round(options.pace ?? 1), 20));
  const open = units.filter((u) => u.status !== 'done' && u.status !== 'skipped');
  const done = units.filter((u) => u.status === 'done').length;
  const needed = Math.ceil(open.length / pace);
  const from = options.from ?? new Date(Date.now() - 3 * 60 * 60 * 1000);
  // occurrencesOf caps at 52; enough for a year of weekly sittings.
  const sittings = needed > 0 ? occurrencesOf(meeting, { from, count: Math.min(needed, 52) }) : [];

  const upcoming = sittings.slice(0, options.show ?? 6).map((at, i) => ({
    at: at.toISOString(),
    units: open.slice(i * pace, i * pace + pace),
  }));
  const projectedFinish = needed > 0 && sittings.length >= needed ? sittings[needed - 1].toISOString() : null;
  const plannedFinish = [...units].reverse().find((u) => u.targetOn)?.targetOn ?? null;

  let behindBy: number | null = null;
  const firstOpen = open[0];
  if (firstOpen?.targetOn && sittings[0]) {
    const target = new Date(`${firstOpen.targetOn}T12:00:00Z`).getTime();
    const next = sittings[0].getTime();
    const interval =
      sittings[1] ? sittings[1].getTime() - sittings[0].getTime() : 7 * 24 * 60 * 60 * 1000;
    behindBy = Math.round((next - target) / interval);
  }

  return {
    pace,
    total: units.length,
    done,
    remaining: open.length,
    upcoming,
    projectedFinish,
    plannedFinish,
    behindBy,
  };
}

/**
 * Set every open unit's target date from the schedule: the baseline the
 * timeline measures against. Re-running it re-plans from today, which is how a
 * circle that has slipped adopts a new plan on purpose.
 */
export async function baselineCircleTargets(
  orgId: string,
  threadId: string,
  pace = 1
): Promise<number> {
  const thread = await circleThread(orgId, threadId);
  if (!thread?.scheduled_at) return 0;
  const units = await listCircleUnits(orgId, threadId);
  const open = units.filter((u) => u.status !== 'done' && u.status !== 'skipped');
  const step = Math.max(1, Math.round(pace));
  const meeting = {
    scheduledAt: thread.scheduled_at,
    recurrencePattern: thread.recurrence_pattern,
    recurrenceUntil: thread.recurrence_until,
  };
  // Beyond 52 sittings, keep stepping from the last date computed.
  const dates: Date[] = [];
  let from = new Date(Date.now() - 3 * 60 * 60 * 1000);
  while (dates.length < Math.ceil(open.length / step)) {
    const batch = occurrencesOf(meeting, { from, count: 52 });
    if (batch.length === 0) break;
    dates.push(...batch);
    from = new Date(batch[batch.length - 1].getTime() + 60_000);
  }
  const updates = open.map((u, i) => ({ id: u.id, target: dates[Math.floor(i / step)] ?? null }));
  await db.begin(async (tx) => {
    for (const u of updates) {
      await tx`
        UPDATE circle_units SET target_on = ${u.target ? u.target.toISOString().slice(0, 10) : null}::date, updated_at = NOW()
        WHERE id = ${u.id} AND org_id = ${orgId}
      `;
    }
  });
  await db`
    UPDATE threads
    SET metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json({ circle: { ...circleMeta(thread.metadata), pace: step } })}
    WHERE id = ${threadId} AND org_id = ${orgId}
  `;
  return updates.filter((u) => u.target).length;
}

// ── The circle's space ──────────────────────────────────────────────────────

export interface CircleMeta {
  pace?: number;
  /** Relative to the org storage root. */
  folder?: string;
  /** org_feeds slug of the circle's discussion. */
  feedSlug?: string;
}

export function circleMeta(metadata: Record<string, unknown> | null | undefined): CircleMeta {
  const raw = (metadata?.circle ?? null) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') return {};
  return {
    pace: typeof raw.pace === 'number' ? raw.pace : undefined,
    folder: typeof raw.folder === 'string' ? raw.folder : undefined,
    feedSlug: typeof raw.feedSlug === 'string' ? raw.feedSlug : undefined,
  };
}

/** Folder name for a circle: its slug, filesystem-safe. */
export function circleFolderName(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'circle';
}

export const CIRCLE_MATERIAL = 'Material';
export const CIRCLE_RECORDINGS = 'Meeting Recordings';

/**
 * Make sure a circle has its folder, Talk room and discussion feed. Safe to
 * re-run: each piece is created only when missing. Returns warnings for the
 * pieces that could not be made, rather than failing the whole call.
 *
 *   Private/Circles/<slug>/Material/
 *   Private/Circles/<slug>/Meeting Recordings/
 *
 * The folder is under Private/ because media-authz serves any path without a
 * Private segment to anonymous visitors. The Talk room is type 3 (public) so
 * members without a Nextcloud account can join as guests. The feed has
 * min_role 'member' and sits under the site's `groups` feed when one exists.
 */
export async function ensureCircleSpace(
  orgId: string,
  threadId: string
): Promise<{ folder: string; talkToken: string | null; feedSlug: string | null; warnings: string[] }> {
  const thread = await circleThread(orgId, threadId);
  if (!thread) throw new Error('Circle not found');
  const warnings: string[] = [];
  const meta = circleMeta(thread.metadata);
  const slug = circleFolderName(thread.slug ?? thread.id);

  // Folder, one segment at a time (MKCOL does not create parents; 405 = exists).
  const folder = meta.folder ?? `Private/Circles/${slug}`;
  try {
    const segments = ['Private', 'Private/Circles', folder, `${folder}/${CIRCLE_MATERIAL}`, `${folder}/${CIRCLE_RECORDINGS}`];
    for (const s of segments) await createOrgFolder(orgId, s);
  } catch (err) {
    console.error('[reading-circle] folder:', err);
    warnings.push('The circle folder could not be created.');
  }

  // Talk room.
  let talkToken = thread.nextcloud_talk_token;
  if (!talkToken) {
    try {
      const [author] = await db<{ nextcloud_user_id: string | null }[]>`
        SELECT nextcloud_user_id FROM users WHERE id = ${thread.author_id}
      `;
      talkToken = await createTalkRoom(thread.title, 'public', {
        moderator: author?.nextcloud_user_id ?? null,
        listable: 1,
      });
      if (talkToken) {
        await db`UPDATE threads SET nextcloud_talk_token = ${talkToken} WHERE id = ${threadId} AND org_id = ${orgId}`;
      } else {
        warnings.push('The Talk room could not be created.');
      }
    } catch (err) {
      console.error('[reading-circle] talk room:', err);
      warnings.push('The Talk room could not be created.');
    }
  }

  // Discussion feed.
  let feedSlug: string | null = meta.feedSlug ?? null;
  try {
    const wanted = feedSlug ?? `circle-${slug}`.slice(0, 50);
    if (!(await getOrgFeed(orgId, wanted).catch(() => null))) {
      await upsertOrgFeed(orgId, wanted, {
        name: thread.title.slice(0, 100),
        tagline: 'Discussion for this reading circle.',
        isPublic: false,
        // No role gate: anyone with a role in the org (viewers included)
        // reads and replies. The circle's topics are ORGANIZATION-visible, so
        // they stay off public listings and away from anonymous visitors.
        minRole: null,
        sortOrder: 50,
      });
      if (await getOrgFeed(orgId, 'groups').catch(() => null)) {
        await db`
          UPDATE org_feeds SET parent_slug = 'groups'
          WHERE org_id = ${orgId} AND slug = ${wanted} AND parent_slug IS NULL
        `;
      }
    }
    feedSlug = wanted;
  } catch (err) {
    console.error('[reading-circle] feed:', err);
    warnings.push('The discussion feed could not be created.');
  }

  await db`
    UPDATE threads
    SET metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json({ circle: { ...meta, folder, ...(feedSlug ? { feedSlug } : {}) } })}
    WHERE id = ${threadId} AND org_id = ${orgId}
  `;

  return { folder, talkToken, feedSlug, warnings };
}

// ── Sessions: one topic thread per sitting ──────────────────────────────────
//
// A sitting is an occurrence of the circle's thread; what happened at it is the
// occurrence row above. What a sitting needs beyond that — its own RSVP, its
// comments, its collaborative document, a forum topic people can find — are
// all things a THREAD has, and RSVP on this platform is keyed by thread, not by
// date. So each sitting gets a `post` in the circle's discussion feed, gathered
// onto the circle as `produced` (migration 131): the model the site already
// used for written-up sittings, made ahead of time instead of afterwards.
//
// metadata.circleSession = { circleId, occurrenceAt, number } ties it back.
// A `post` is not in SCHEDULED_KINDS, so the org calendar sync does not push
// each sitting beside the circle's own recurring event.

export interface CircleSessionTopic {
  id: string;
  slug: string | null;
  title: string;
  /** ISO timestamp of the occurrence this topic belongs to. */
  occurrenceAt: string;
  number: number;
  documentUrl: string | null;
}

/** 1-based position of `at` in the circle's series (first sitting = 1). */
export function circleOccurrenceNumber(
  meeting: { scheduledAt: Date | string | null; recurrencePattern: string | null; recurrenceUntil?: Date | string | null },
  at: Date
): number {
  if (!meeting.scheduledAt) return 1;
  const start = new Date(meeting.scheduledAt);
  if (!meeting.recurrencePattern) return 1;
  let n = 0;
  let from = new Date(start.getTime() - 60_000);
  // Walk the series in batches; bounded so a bad date cannot spin.
  for (let batch = 0; batch < 40; batch++) {
    const dates = occurrencesOf(
      { scheduledAt: start, recurrencePattern: meeting.recurrencePattern, recurrenceUntil: null },
      { from, count: 52 }
    );
    if (dates.length === 0) break;
    for (const d of dates) {
      n += 1;
      if (Math.abs(d.getTime() - at.getTime()) < 60_000 || d.getTime() > at.getTime()) return n;
    }
    from = new Date(dates[dates.length - 1].getTime() + 60_000);
  }
  return Math.max(1, n);
}

export async function listCircleSessionTopics(orgId: string, circleId: string): Promise<CircleSessionTopic[]> {
  const rows = await db<
    Array<{ id: string; slug: string | null; title: string; at: string; number: string | null; document_url: string | null }>
  >`
    SELECT id, slug, title, document_url,
           metadata->'circleSession'->>'occurrenceAt' AS at,
           metadata->'circleSession'->>'number' AS number
    FROM threads
    WHERE org_id = ${orgId}
      AND status <> 'archived'
      AND metadata->'circleSession'->>'circleId' = ${circleId}
    ORDER BY metadata->'circleSession'->>'occurrenceAt'
  `;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    occurrenceAt: new Date(r.at).toISOString(),
    number: Number(r.number) || 1,
    documentUrl: r.document_url,
  }));
}

/**
 * The sitting's topic, made if missing. Needs the circle's space (its feed):
 * the topic lives in the circle's members-only discussion.
 */
export async function ensureCircleSessionTopic(
  orgId: string,
  circleId: string,
  occurrenceAt: Date,
  actorUserId: string
): Promise<CircleSessionTopic> {
  const at = occurrenceAt.toISOString();
  const existing = (await listCircleSessionTopics(orgId, circleId)).find((t) => t.occurrenceAt === at);
  if (existing) return existing;

  const circle = await circleThread(orgId, circleId);
  if (!circle) throw new Error('Circle not found');
  let meta = circleMeta(circle.metadata);
  if (!meta.feedSlug) {
    await ensureCircleSpace(orgId, circleId);
    meta = circleMeta((await circleThread(orgId, circleId))?.metadata ?? null);
  }
  if (!meta.feedSlug) throw new Error('The circle has no discussion feed');

  const [dur] = await db<{ duration_minutes: number | null }[]>`
    SELECT duration_minutes FROM threads WHERE id = ${circleId} AND org_id = ${orgId}
  `;
  const number = circleOccurrenceNumber(
    { scheduledAt: circle.scheduled_at, recurrencePattern: circle.recurrence_pattern },
    occurrenceAt
  );
  // Default title: the session number and what it reads, e.g.
  // "Session 2 · TOTM 1 — The Force". Falls back to the circle's name.
  const unit = await sessionUnit(orgId, circleId, occurrenceAt, circle).catch(() => null);
  const reading = unit ? (unit.label ? `${unit.label} — ${unit.title}` : unit.title) : circle.title;
  const topic = await createThread({
    kind: 'post',
    orgId,
    authorId: actorUserId,
    title: `Session ${number} · ${reading}`.slice(0, 200),
    slug: `${circle.slug ?? circle.id}-session-${number}`,
    status: 'published',
    visibility: 'ORGANIZATION',
    section: meta.feedSlug,
    scheduledAt: occurrenceAt,
    durationMinutes: dur?.duration_minutes ?? null,
    isRsvpEnabled: true,
    metadata: { circleSession: { circleId, occurrenceAt: at, number } },
  } as never);
  await gatherOnto(circleId, { targetType: 'thread', targetThreadId: topic.id, relation: 'produced', addedBy: actorUserId });
  return { id: topic.id, slug: topic.slug ?? null, title: topic.title, occurrenceAt: at, number, documentUrl: null };
}

/**
 * The unit a sitting at `at` starts in: after the latest stop recorded before
 * it, moved on by `pace` units for each sitting between that stop (or today)
 * and `at`. An estimate for sittings further ahead; exact for the next one.
 */
async function sessionUnit(
  orgId: string,
  circleId: string,
  at: Date,
  circle: NonNullable<Awaited<ReturnType<typeof circleThread>>>
): Promise<CircleUnit | null> {
  const units = await listCircleUnits(orgId, circleId);
  if (units.length === 0) return null;
  const pace = Math.max(1, circleMeta(circle.metadata).pace ?? 1);
  const [prior] = await db<Array<{ occurrence_at: Date; stop_unit_id: string; stop_position: number | null }>>`
    SELECT occurrence_at, stop_unit_id, stop_position FROM meeting_occurrence_notes
    WHERE thread_id = ${circleId} AND stop_unit_id IS NOT NULL AND occurrence_at < ${at.toISOString()}::timestamptz
    ORDER BY occurrence_at DESC LIMIT 1
  `;
  let index: number;
  let from: Date;
  if (prior) {
    const i = units.findIndex((u) => u.id === prior.stop_unit_id);
    const u = units[i];
    const finished = u && (u.status === 'done' || (u.length != null && (prior.stop_position ?? 0) >= u.length));
    index = i < 0 ? 0 : finished ? i + 1 : i;
    from = new Date(new Date(prior.occurrence_at).getTime() + 60_000);
  } else {
    index = Math.max(0, units.findIndex((u) => u.status !== 'done' && u.status !== 'skipped'));
    from = new Date(Date.now() - 3 * 3_600_000);
  }
  // Sittings between the reference point and this one each move on by `pace`.
  const between = circle.scheduled_at
    ? occurrencesOf(
        { scheduledAt: circle.scheduled_at, recurrencePattern: circle.recurrence_pattern, recurrenceUntil: circle.recurrence_until },
        { from, count: 52 }
      ).filter((d) => d.getTime() < at.getTime() - 60_000).length
    : 0;
  return units[Math.min(units.length - 1, index + between * pace)] ?? null;
}

/**
 * The sitting's collaborative document (a Nextcloud Text file with an editable
 * share link). Idempotent. The link is writable by anyone holding it, so it is
 * only ever shown to members.
 */
export async function ensureCircleSessionDocument(orgId: string, sessionId: string, timeZone = 'UTC'): Promise<string | null> {
  const [t] = await db<Array<{ id: string; title: string; document_url: string | null; circle_id: string | null; at: string | null; number: string | null }>>`
    SELECT id, title, document_url,
           metadata->'circleSession'->>'circleId' AS circle_id,
           metadata->'circleSession'->>'occurrenceAt' AS at,
           metadata->'circleSession'->>'number' AS number
    FROM threads WHERE id = ${sessionId} AND org_id = ${orgId}
  `;
  if (!t) throw new Error('Session not found');
  if (t.document_url) return t.document_url;

  // The sitting's own folder, beside its recording and transcript, under the
  // circle's Private/ tree — never Media/, which is served to anyone.
  const circle = t.circle_id ? await circleThread(orgId, t.circle_id) : null;
  const folder = circle ? circleMeta(circle.metadata).folder : undefined;
  if (!folder || !t.at) throw new Error('The circle has no folder yet');
  const sessionFolder = `${folder}/${CIRCLE_RECORDINGS}/${circleSessionFolderName(new Date(t.at), Number(t.number) || 1, timeZone)}`;
  await createOrgFolder(orgId, `${folder}/${CIRCLE_RECORDINGS}`);
  await createOrgFolder(orgId, sessionFolder);
  const doc = await createCollaborativeDocument(orgId, t.title, t.id, undefined, {
    folder: sessionFolder,
    filename: 'Session notes.md',
  });
  if (!doc?.url) return null;
  await db`UPDATE threads SET document_url = ${doc.url} WHERE id = ${t.id} AND org_id = ${orgId}`;
  return doc.url;
}

/** "2026-10-01 Session 03" — one folder per sitting under Meeting Recordings (sorts by date). */
export function circleSessionFolderName(at: Date, number: number, timeZone = 'UTC'): string {
  // en-CA formats a date as YYYY-MM-DD; the zone keeps an evening sitting on its own day.
  const day = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  return `${day} Session ${String(number).padStart(2, '0')}`;
}

/** The host's notes for one sitting (meeting_occurrence_notes.note), leaving the stop and plan alone. */
export async function setCircleSessionNotes(input: {
  orgId: string;
  circleId: string;
  occurrenceAt: Date;
  notes: string | null;
  actorUserId: string;
}): Promise<void> {
  if (!(await circleThread(input.orgId, input.circleId))) throw new Error('Circle not found');
  const note = input.notes?.trim() ? input.notes.trim().slice(0, 20000) : null;
  await db`
    INSERT INTO meeting_occurrence_notes (thread_id, occurrence_at, note, recorded_by)
    VALUES (${input.circleId}, ${input.occurrenceAt.toISOString()}::timestamptz, ${note}, ${input.actorUserId})
    ON CONFLICT (thread_id, occurrence_at) DO UPDATE
      SET note = EXCLUDED.note, recorded_by = EXCLUDED.recorded_by, updated_at = NOW()
  `;
}

/** The week's plan line for one sitting (meeting_occurrence_notes.plan). */
export async function setCircleSessionPlan(input: {
  orgId: string;
  circleId: string;
  occurrenceAt: Date;
  plan: string | null;
  actorUserId: string;
}): Promise<void> {
  if (!(await circleThread(input.orgId, input.circleId))) throw new Error('Circle not found');
  const plan = input.plan?.trim() ? input.plan.trim().slice(0, 2000) : null;
  await db`
    INSERT INTO meeting_occurrence_notes (thread_id, occurrence_at, plan, planned_by, planned_at)
    VALUES (${input.circleId}, ${input.occurrenceAt.toISOString()}::timestamptz, ${plan}, ${input.actorUserId}, NOW())
    ON CONFLICT (thread_id, occurrence_at) DO UPDATE
      SET plan = EXCLUDED.plan, planned_by = EXCLUDED.planned_by, planned_at = NOW()
  `;
}

// ── Circle settings ─────────────────────────────────────────────────────────

/** Schedule: first sitting, cadence (null = once), length, optional end. */
export async function setCircleSchedule(
  orgId: string,
  circleId: string,
  input: { scheduledAt: Date | null; recurrence: 'WEEKLY' | 'MONTHLY' | 'DAILY' | null; durationMinutes: number | null; until: Date | null }
): Promise<void> {
  await db`
    UPDATE threads
    SET scheduled_at = ${input.scheduledAt},
        recurrence_pattern = ${input.recurrence},
        duration_minutes = ${input.durationMinutes},
        recurrence_until = ${input.until},
        updated_at = NOW()
    WHERE id = ${circleId} AND org_id = ${orgId}
  `;
}

/**
 * Merge keys into metadata.circle (structure, pace, …) without dropping the
 * folder/feed keys ensureCircleSpace wrote. `structure` is HTML the caller has
 * sanitised.
 */
export async function updateCircleMeta(
  orgId: string,
  circleId: string,
  patch: {
    structure?: string | null;
    pace?: number;
    /** The passage a host posts after a sitting, shown on the home page. Plain text. */
    excerpt?: { text: string; where: string | null; page: number | null; at: string } | null;
  }
): Promise<void> {
  const circle = await circleThread(orgId, circleId);
  if (!circle) throw new Error('Circle not found');
  const current = ((circle.metadata?.circle ?? {}) as Record<string, unknown>) || {};
  const next = { ...current, ...patch };
  await db`
    UPDATE threads
    SET metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json({ circle: next } as never)}
    WHERE id = ${circleId} AND org_id = ${orgId}
  `;
}

/** The circle's cover image (canonical /api/media/… URL), or null to clear. */
export async function setCircleCover(orgId: string, circleId: string, url: string | null): Promise<void> {
  await db`
    UPDATE threads
    SET metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json({ coverImageUrl: url } as never)}
    WHERE id = ${circleId} AND org_id = ${orgId}
  `;
}
