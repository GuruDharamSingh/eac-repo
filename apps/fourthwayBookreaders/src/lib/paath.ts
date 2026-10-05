import { db } from "@elkdonis/db";
import { davList, davMkcol, davMove, davPut, listOrgFiles, resolveOrgPath } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer, type Viewer } from "@/lib/auth";
import { withBase } from "@/lib/base-path";
import { zonedInputToDate } from "@/lib/format";

/**
 * The Akhand Path: a complete reading of the Sri Guru Granth Sahib, passage by
 * passage, day by day (scripts/seed-akhand-path.mts made it).
 *
 * It is a reading circle like any other — a `reading_group` thread whose plan
 * is `circle_units`, one per passage, with the text in unit metadata — read
 * through its own page rather than the circle page, because it is read one
 * passage at a time and checked off as it goes:
 *
 *   a passage read      circle_units.status 'done', done_at, done_by (191)
 *   a thought on it     circle_unit_notes (191)
 *   a day's entry       the passages whose done_at falls on that day (in the
 *                       site's zone), the thoughts left that day, the day's
 *                       note and stop point in meeting_occurrence_notes keyed
 *                       by the day's midnight, and the recordings in
 *                       <folder>/Meeting Recordings/<YYYY-MM-DD> Day N/
 *
 * Who may open it: the thread's author and its readers (a `yes` RSVP). While
 * the thread is INVITE_ONLY — private — nobody else; every other listing on
 * the network already hides INVITE_ONLY rows. Made public (visibility PUBLIC),
 * anyone with a role in the org may read along too.
 */

const ORG = siteConfig.orgId;
const TZ = siteConfig.timeZone;
export const PAATH_SLUG = "akhand-path";
export const PAATH_RECORDINGS = "Meeting Recordings";

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL;
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER || "";
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD || "";
const TALK_BASE = process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? process.env.NEXTCLOUD_PUBLIC_URL ?? null;

export interface PaathCircle {
  id: string;
  title: string;
  authorId: string;
  isPrivate: boolean;
  talkToken: string | null;
  talkUrl: string | null;
  /** Relative to the org storage root, e.g. Private/Circles/akhand-path. */
  folder: string;
  /** YYYY-MM-DD: Day 1. */
  startedOn: string;
  totalAngs: number;
  edition: string | null;
}

export interface PassageNote {
  id: string;
  author: string;
  body: string;
  at: string;
  mine: boolean;
}

export interface Passage {
  id: string;
  position: number;
  label: string;
  ang: number;
  angEnd: number;
  section: string;
  sectionGurmukhi: string | null;
  subsection: string | null;
  vaar: string | null;
  heading: string;
  authors: string[];
  form: string;
  part: number;
  parts: number;
  english: string;
  gurmukhi: string;
  doneAt: string | null;
  doneBy: string | null;
  notes: PassageNote[];
}

export interface PaathProgress {
  total: number;
  done: number;
  /** Position of the first passage not yet read, or null when complete. */
  nextPosition: number | null;
  /** The Ang the reading has reached. */
  ang: number;
  sections: Array<{ name: string; from: number; to: number; done: number; total: number }>;
}

export interface PaathDay {
  day: string;
  number: number;
  passages: number;
  angFrom: number | null;
  angTo: number | null;
  firstAt: string | null;
  lastAt: string | null;
  notes: number;
  recordings: number;
  hasNote: boolean;
  /** Banis and raags read that day, in reading order. */
  sections: string[];
  /** Named headings (a Vaar, Sukhmani, Anand...) read that day, in order. */
  works: string[];
  /** Authors of the passages read, most passages first. */
  authors: Array<{ name: string; passages: number }>;
}

export interface Recording {
  name: string;
  href: string;
  size: number;
  at: string | null;
}

// ── Days ────────────────────────────────────────────────────────────────────

/** The site-zone date of an instant, YYYY-MM-DD. */
export function dayOf(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function isDay(s: string | null | undefined): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Midnight at the start of `day`, in the site's zone. The day's occurrence key. */
export function dayStart(day: string): Date {
  return zonedInputToDate(day)!;
}

export function dayRange(day: string): { from: Date; to: Date } {
  return { from: dayStart(day), to: dayStart(addDays(day, 1)) };
}

export function dayNumber(circle: PaathCircle, day: string): number {
  const diff = Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${circle.startedOn}T12:00:00Z`)) / 86_400_000);
  return diff + 1;
}

export function dayFolderName(circle: PaathCircle, day: string): string {
  return `${day} Day ${dayNumber(circle, day)}`;
}

export function neighbourDay(day: string, n: number): string {
  return addDays(day, n);
}

// ── The circle and who may read it ──────────────────────────────────────────

export async function getPaathCircle(): Promise<PaathCircle | null> {
  const [row] = await db<
    Array<{ id: string; title: string; author_id: string; visibility: string; nextcloud_talk_token: string | null; metadata: Record<string, any> | null }>
  >`
    SELECT id, title, author_id, visibility, nextcloud_talk_token, metadata
    FROM threads
    WHERE org_id = ${ORG} AND kind = 'reading_group' AND slug = ${PAATH_SLUG} AND status = 'published'
    LIMIT 1
  `.catch(() => []);
  if (!row) return null;
  const paath = (row.metadata?.paath ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    title: row.title,
    authorId: row.author_id,
    isPrivate: row.visibility !== "PUBLIC",
    talkToken: row.nextcloud_talk_token,
    talkUrl: row.nextcloud_talk_token && TALK_BASE ? `${TALK_BASE}/call/${row.nextcloud_talk_token}` : null,
    folder: typeof row.metadata?.circle?.folder === "string" ? row.metadata.circle.folder : `Private/Circles/${PAATH_SLUG}`,
    startedOn: isDay(paath.startedOn as string) ? (paath.startedOn as string) : dayOf(),
    totalAngs: typeof paath.totalAngs === "number" ? paath.totalAngs : 1430,
    edition: typeof paath.edition === "string" ? paath.edition : null,
  };
}

export async function canReadPaath(circle: PaathCircle, viewer: Viewer | null): Promise<boolean> {
  if (!viewer) return false;
  if (viewer.userId === circle.authorId) return true;
  const [rsvp] = await db<{ status: string }[]>`
    SELECT status FROM thread_rsvps WHERE thread_id = ${circle.id} AND user_id = ${viewer.userId}
  `.catch(() => []);
  if (rsvp?.status === "yes") return true;
  return !circle.isPrivate && viewer.isAffiliate;
}

/** The circle and the viewer, when the viewer may read it; null otherwise. */
export async function getPaathReader(): Promise<{ circle: PaathCircle; viewer: Viewer } | null> {
  const [circle, viewer] = await Promise.all([getPaathCircle(), getViewer().catch(() => null)]);
  if (!circle || !viewer) return null;
  return (await canReadPaath(circle, viewer)) ? { circle, viewer } : null;
}

/** For /api/circle-file: may this viewer read a file at this org-relative path? */
export async function paathFileAllowed(relative: string, viewer: Viewer | null): Promise<boolean | null> {
  const circle = await getPaathCircle();
  if (!circle || !(relative === circle.folder || relative.startsWith(`${circle.folder}/`))) return null;
  return canReadPaath(circle, viewer);
}

// ── Reading ─────────────────────────────────────────────────────────────────

interface UnitRow {
  id: string;
  position: number;
  label: string | null;
  title: string;
  metadata: Record<string, any>;
  done_at: Date | null;
  done_by_name: string | null;
}

const UNIT_COLUMNS = db`
  u.id, u.position, u.label, u.title, u.metadata, u.done_at,
  (SELECT COALESCE(x.display_name, split_part(x.email, '@', 1)) FROM users x WHERE x.id = u.done_by) AS done_by_name
`;

function toPassage(r: UnitRow, notes: PassageNote[]): Passage {
  const m = r.metadata ?? {};
  return {
    id: r.id,
    position: r.position,
    label: r.label ?? `Ang ${m.ang}`,
    ang: Number(m.ang ?? 0),
    angEnd: Number(m.angEnd ?? m.ang ?? 0),
    section: String(m.section ?? ""),
    sectionGurmukhi: m.sectionGurmukhi ?? null,
    subsection: m.subsection ?? null,
    vaar: m.vaar ?? null,
    heading: String(m.heading ?? r.title),
    authors: Array.isArray(m.authors) ? m.authors : [],
    form: String(m.form ?? ""),
    part: Number(m.part ?? 1),
    parts: Number(m.parts ?? 1),
    english: String(m.english ?? ""),
    gurmukhi: String(m.gurmukhi ?? ""),
    doneAt: r.done_at ? new Date(r.done_at).toISOString() : null,
    doneBy: r.done_by_name,
    notes,
  };
}

async function notesFor(unitIds: string[], viewerId: string): Promise<Map<string, PassageNote[]>> {
  const out = new Map<string, PassageNote[]>();
  if (unitIds.length === 0) return out;
  const rows = await db<Array<{ id: string; unit_id: string; user_id: string | null; body: string; created_at: Date; author: string | null }>>`
    SELECT n.id, n.unit_id, n.user_id, n.body, n.created_at,
           COALESCE(u.display_name, split_part(u.email, '@', 1)) AS author
    FROM circle_unit_notes n LEFT JOIN users u ON u.id = n.user_id
    WHERE n.unit_id = ANY(${unitIds}) AND n.deleted_at IS NULL
    ORDER BY n.created_at
  `;
  for (const r of rows) {
    const list = out.get(r.unit_id) ?? [];
    list.push({ id: r.id, author: r.author ?? "A reader", body: r.body, at: new Date(r.created_at).toISOString(), mine: r.user_id === viewerId });
    out.set(r.unit_id, list);
  }
  return out;
}

async function withNotes(rows: UnitRow[], viewerId: string): Promise<Passage[]> {
  const notes = await notesFor(rows.map((r) => r.id), viewerId);
  return rows.map((r) => toPassage(r, notes.get(r.id) ?? []));
}

export async function getProgress(circle: PaathCircle): Promise<PaathProgress> {
  const sections = await db<Array<{ name: string; from: number; to: number; done: number; total: number }>>`
    SELECT metadata->>'section' AS name, MIN(position) AS "from", MAX(position) AS "to",
           COUNT(*) FILTER (WHERE status IN ('done', 'skipped'))::int AS done, COUNT(*)::int AS total
    FROM circle_units WHERE thread_id = ${circle.id}
    GROUP BY 1 ORDER BY 2
  `;
  const [next] = await db<Array<{ position: number; ang: number }>>`
    SELECT position, (metadata->>'ang')::int AS ang FROM circle_units
    WHERE thread_id = ${circle.id} AND status NOT IN ('done', 'skipped')
    ORDER BY position LIMIT 1
  `;
  const total = sections.reduce((s, x) => s + x.total, 0);
  const done = sections.reduce((s, x) => s + x.done, 0);
  return { total, done, nextPosition: next?.position ?? null, ang: next?.ang ?? circle.totalAngs, sections };
}

/** The next `limit` passages not yet read, from `from` on. */
export async function getUnread(circle: PaathCircle, viewerId: string, limit: number, from = 0): Promise<Passage[]> {
  const rows = await db<UnitRow[]>`
    SELECT ${UNIT_COLUMNS} FROM circle_units u
    WHERE u.thread_id = ${circle.id} AND u.status NOT IN ('done', 'skipped') AND u.position >= ${from}
    ORDER BY u.position LIMIT ${Math.min(Math.max(limit, 1), 10)}
  `;
  return withNotes(rows, viewerId);
}

export async function getPassage(circle: PaathCircle, viewerId: string, id: string): Promise<Passage | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await db<UnitRow[]>`SELECT ${UNIT_COLUMNS} FROM circle_units u WHERE u.thread_id = ${circle.id} AND u.id = ${id}`;
  return rows[0] ? (await withNotes(rows, viewerId))[0] : null;
}

// ── The public Granth: the text only, for anyone ────────────────────────────
// Visitors read the whole Guru Granth Sahib from the Akhand Path's passages.
// Nothing of the reading itself (who read what, thoughts, recordings) is
// exposed: these return text and place only.

export interface GranthSection {
  name: string;
  gurmukhi: string | null;
  kind: string;
  angFrom: number;
  angTo: number;
  passages: number;
}

export async function getGranthIndex(circle: PaathCircle): Promise<GranthSection[]> {
  return db<GranthSection[]>`
    SELECT metadata->>'section' AS name, MIN(metadata->>'sectionGurmukhi') AS gurmukhi, MIN(metadata->>'sectionKind') AS kind,
           MIN((metadata->>'ang')::int) AS "angFrom", MAX((metadata->>'angEnd')::int) AS "angTo", COUNT(*)::int AS passages
    FROM circle_units WHERE thread_id = ${circle.id}
    GROUP BY 1 ORDER BY MIN(position)
  `;
}

/** The passages on one Ang (those that start on it, or run across it). */
export async function getAng(circle: PaathCircle, ang: number): Promise<Passage[]> {
  const rows = await db<UnitRow[]>`
    SELECT u.id, u.position, u.label, u.title, u.metadata, NULL::timestamptz AS done_at, NULL::text AS done_by_name
    FROM circle_units u
    WHERE u.thread_id = ${circle.id}
      AND (u.metadata->>'ang')::int <= ${ang} AND (u.metadata->>'angEnd')::int >= ${ang}
    ORDER BY u.position
  `;
  return rows.map((r) => toPassage(r, []));
}

export async function getPassagesOfDay(circle: PaathCircle, viewerId: string, day: string): Promise<Passage[]> {
  const { from, to } = dayRange(day);
  const rows = await db<UnitRow[]>`
    SELECT ${UNIT_COLUMNS} FROM circle_units u
    WHERE u.thread_id = ${circle.id} AND u.done_at >= ${from} AND u.done_at < ${to}
    ORDER BY u.done_at, u.position
  `;
  return withNotes(rows, viewerId);
}

/** Thoughts left on a day on passages read on another day. */
export async function getOtherNotesOfDay(circle: PaathCircle, day: string, exclude: string[]): Promise<Array<PassageNote & { passage: string }>> {
  const { from, to } = dayRange(day);
  const rows = await db<Array<{ id: string; body: string; created_at: Date; author: string | null; label: string | null; title: string }>>`
    SELECT n.id, n.body, n.created_at, COALESCE(x.display_name, split_part(x.email, '@', 1)) AS author, u.label, u.title
    FROM circle_unit_notes n
    JOIN circle_units u ON u.id = n.unit_id
    LEFT JOIN users x ON x.id = n.user_id
    WHERE n.thread_id = ${circle.id} AND n.deleted_at IS NULL
      AND n.created_at >= ${from} AND n.created_at < ${to}
      AND NOT (n.unit_id = ANY(${exclude.length ? exclude : ["00000000-0000-0000-0000-000000000000"]}::uuid[]))
    ORDER BY n.created_at
  `;
  return rows.map((r) => ({ id: r.id, body: r.body, at: new Date(r.created_at).toISOString(), author: r.author ?? "A reader", mine: false, passage: `${r.label ?? ""} · ${r.title}` }));
}

export async function getDayNote(circle: PaathCircle, day: string): Promise<string> {
  const [row] = await db<{ note: string | null }[]>`
    SELECT note FROM meeting_occurrence_notes WHERE thread_id = ${circle.id} AND occurrence_at = ${dayStart(day)}
  `;
  return row?.note ?? "";
}

export async function getDays(circle: PaathCircle): Promise<PaathDay[]> {
  const what = await db<Array<{ day: string; section: string | null; work: string | null; authors: string[] | null }>>`
    SELECT to_char(done_at AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day, metadata->>'section' AS section,
           COALESCE(metadata->>'vaar', metadata->>'subsection') AS work,
           ARRAY(SELECT jsonb_array_elements_text(COALESCE(metadata->'authors', '[]'::jsonb))) AS authors
    FROM circle_units WHERE thread_id = ${circle.id} AND done_at IS NOT NULL
    ORDER BY position
  `;
  const read = await db<Array<{ day: string; passages: number; ang_from: number; ang_to: number; first_at: Date; last_at: Date }>>`
    SELECT to_char(done_at AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day, COUNT(*)::int AS passages,
           MIN((metadata->>'ang')::int) AS ang_from, MAX((metadata->>'angEnd')::int) AS ang_to,
           MIN(done_at) AS first_at, MAX(done_at) AS last_at
    FROM circle_units WHERE thread_id = ${circle.id} AND done_at IS NOT NULL
    GROUP BY 1
  `;
  const notes = await db<Array<{ day: string; n: number }>>`
    SELECT to_char(created_at AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
    FROM circle_unit_notes WHERE thread_id = ${circle.id} AND deleted_at IS NULL GROUP BY 1
  `;
  const dayNotes = await db<Array<{ day: string }>>`
    SELECT to_char(occurrence_at AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day
    FROM meeting_occurrence_notes WHERE thread_id = ${circle.id} AND note IS NOT NULL AND note <> ''
  `;
  const recordings = await recordingCounts(circle);

  const days = new Map<string, PaathDay>();
  const get = (day: string) => {
    if (!days.has(day)) {
      days.set(day, { day, number: dayNumber(circle, day), passages: 0, angFrom: null, angTo: null, firstAt: null, lastAt: null, notes: 0, recordings: 0, hasNote: false, sections: [], works: [], authors: [] });
    }
    return days.get(day)!;
  };
  for (const r of read) Object.assign(get(r.day), { passages: r.passages, angFrom: r.ang_from, angTo: r.ang_to, firstAt: new Date(r.first_at).toISOString(), lastAt: new Date(r.last_at).toISOString() });
  for (const r of notes) get(r.day).notes = r.n;
  const tally = new Map<string, Map<string, number>>();
  for (const r of what) {
    const d = get(r.day);
    if (r.section && !d.sections.includes(r.section)) d.sections.push(r.section);
    if (r.work && !d.works.includes(r.work)) d.works.push(r.work);
    const t = tally.get(r.day) ?? new Map<string, number>();
    for (const a of r.authors ?? []) t.set(a, (t.get(a) ?? 0) + 1);
    tally.set(r.day, t);
  }
  for (const [day, t] of tally) get(day).authors = [...t].map(([name, passages]) => ({ name, passages })).sort((a, b) => b.passages - a.passages);
  for (const r of dayNotes) get(r.day).hasNote = true;
  for (const [day, n] of recordings) get(day).recordings = n;
  return [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
}

// ── Writes ──────────────────────────────────────────────────────────────────

async function ownUnit(circle: PaathCircle, unitId: string): Promise<boolean> {
  const [row] = await db<{ id: string }[]>`SELECT id FROM circle_units WHERE id = ${unitId} AND thread_id = ${circle.id} AND org_id = ${ORG}`;
  return Boolean(row);
}

/**
 * Check a passage off (or undo it). The day's entry keeps the stop point:
 * the last passage checked that day, so "where we are" survives without
 * anyone having to say so.
 */
export async function markRead(circle: PaathCircle, viewer: Viewer, unitId: string, done: boolean): Promise<boolean> {
  if (!(await ownUnit(circle, unitId))) return false;
  const day = dayOf();
  const at = dayStart(day);
  await db.begin(async (tx) => {
    if (done) {
      await tx`
        UPDATE circle_units SET status = 'done', done_at = COALESCE(done_at, NOW()), done_by = COALESCE(done_by, ${viewer.userId}), updated_at = NOW()
        WHERE id = ${unitId} AND thread_id = ${circle.id}
      `;
    } else {
      await tx`
        UPDATE circle_units SET status = 'planned', done_at = NULL, done_by = NULL, updated_at = NOW()
        WHERE id = ${unitId} AND thread_id = ${circle.id}
      `;
    }
    const { from, to } = dayRange(day);
    const [last] = await tx<{ id: string }[]>`
      SELECT id FROM circle_units WHERE thread_id = ${circle.id} AND done_at >= ${from} AND done_at < ${to}
      ORDER BY position DESC LIMIT 1
    `;
    await tx`
      INSERT INTO meeting_occurrence_notes (thread_id, occurrence_at, recorded_by, stop_unit_id)
      VALUES (${circle.id}, ${at}, ${viewer.userId}, ${last?.id ?? null})
      ON CONFLICT (thread_id, occurrence_at) DO UPDATE
        SET stop_unit_id = EXCLUDED.stop_unit_id, recorded_by = EXCLUDED.recorded_by, updated_at = NOW()
    `;
  });
  return true;
}

export interface RecentRead {
  id: string;
  label: string;
  heading: string;
  section: string;
  doneAt: string;
  doneBy: string | null;
}

/** The passages checked off most recently, newest first: what "Manage the reading" can put back. */
export async function getRecentlyRead(circle: PaathCircle, limit = 10): Promise<RecentRead[]> {
  const rows = await db<Array<{ id: string; label: string | null; title: string; section: string | null; done_at: Date; done_by: string | null }>>`
    SELECT u.id, u.label, u.title, u.metadata->>'section' AS section, u.done_at,
           (SELECT COALESCE(x.display_name, split_part(x.email, '@', 1)) FROM users x WHERE x.id = u.done_by) AS done_by
    FROM circle_units u
    WHERE u.thread_id = ${circle.id} AND u.done_at IS NOT NULL
    ORDER BY u.done_at DESC, u.position DESC
    LIMIT ${Math.min(Math.max(limit, 1), 100)}
  `;
  return rows.map((r) => ({ id: r.id, label: r.label ?? "", heading: r.title, section: r.section ?? "", doneAt: new Date(r.done_at).toISOString(), doneBy: r.done_by }));
}

/**
 * Put passages back as unread (a mis-click, or a passage to read again). Each
 * affected day's stop point moves back to the last passage still read that day.
 */
export async function markUnread(circle: PaathCircle, unitIds: string[]): Promise<number> {
  const ids = [...new Set(unitIds)].slice(0, 100);
  if (ids.length === 0) return 0;
  return db.begin(async (tx) => {
    const days = await tx<{ day: string }[]>`
      SELECT DISTINCT to_char(done_at AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day
      FROM circle_units WHERE thread_id = ${circle.id} AND id = ANY(${ids}::uuid[]) AND done_at IS NOT NULL
    `;
    const changed = await tx`
      UPDATE circle_units SET status = 'planned', done_at = NULL, done_by = NULL, updated_at = NOW()
      WHERE thread_id = ${circle.id} AND org_id = ${ORG} AND id = ANY(${ids}::uuid[]) AND status = 'done'
      RETURNING id
    `;
    for (const { day } of days) {
      const { from, to } = dayRange(day);
      await tx`
        UPDATE meeting_occurrence_notes
        SET stop_unit_id = (
              SELECT id FROM circle_units WHERE thread_id = ${circle.id} AND done_at >= ${from} AND done_at < ${to}
              ORDER BY position DESC LIMIT 1
            ),
            updated_at = NOW()
        WHERE thread_id = ${circle.id} AND occurrence_at = ${from}
      `;
    }
    return changed.length;
  });
}

export async function addNote(circle: PaathCircle, viewer: Viewer, unitId: string, body: string): Promise<PassageNote | null> {
  const text = body.trim().slice(0, 8000);
  if (!text || !(await ownUnit(circle, unitId))) return null;
  const [row] = await db<{ id: string; created_at: Date }[]>`
    INSERT INTO circle_unit_notes (org_id, thread_id, unit_id, user_id, body)
    VALUES (${ORG}, ${circle.id}, ${unitId}, ${viewer.userId}, ${text})
    RETURNING id, created_at
  `;
  const [me] = await db<{ name: string }[]>`SELECT COALESCE(display_name, split_part(email, '@', 1)) AS name FROM users WHERE id = ${viewer.userId}`;
  return { id: row.id, author: me?.name ?? "You", body: text, at: new Date(row.created_at).toISOString(), mine: true };
}

/** A reader removes their own thought (soft delete, so it can be put back by hand). */
export async function removeNote(circle: PaathCircle, viewer: Viewer, noteId: string): Promise<boolean> {
  const rows = await db`
    UPDATE circle_unit_notes SET deleted_at = NOW()
    WHERE id = ${noteId} AND thread_id = ${circle.id} AND user_id = ${viewer.userId} AND deleted_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

export async function setDayNote(circle: PaathCircle, viewer: Viewer, day: string, note: string): Promise<void> {
  const text = note.trim().slice(0, 20000) || null;
  await db`
    INSERT INTO meeting_occurrence_notes (thread_id, occurrence_at, note, recorded_by)
    VALUES (${circle.id}, ${dayStart(day)}, ${text}, ${viewer.userId})
    ON CONFLICT (thread_id, occurrence_at) DO UPDATE
      SET note = EXCLUDED.note, recorded_by = EXCLUDED.recorded_by, updated_at = NOW()
  `;
}

// ── Recordings ──────────────────────────────────────────────────────────────

function recordingsRoot(circle: PaathCircle): string {
  return resolveOrgPath(ORG, `${circle.folder}/${PAATH_RECORDINGS}`);
}

async function ensureDayFolder(circle: PaathCircle, day: string): Promise<string> {
  const root = recordingsRoot(circle);
  const target = `${root}/${dayFolderName(circle, day)}`;
  await davMkcol(root).catch(() => false);
  await davMkcol(target).catch(() => false);
  return target;
}

function fileHref(url: string): string {
  // Under Private/Circles/: the route that checks circle access itself.
  const path = url.replace(/^\/api\/media\//, "/api/circle-file/");
  return withBase(path.split("/").map((s) => encodeURIComponent(s)).join("/"));
}

async function dayFolders(circle: PaathCircle): Promise<Array<{ day: string; name: string }>> {
  const folders = await listOrgFiles(ORG, `${circle.folder}/${PAATH_RECORDINGS}`).catch(() => []);
  return folders.filter((f) => f.isFolder && isDay(f.name.slice(0, 10))).map((f) => ({ day: f.name.slice(0, 10), name: f.name }));
}

async function recordingCounts(circle: PaathCircle): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const f of await dayFolders(circle)) {
    const files = await listOrgFiles(ORG, `${circle.folder}/${PAATH_RECORDINGS}/${f.name}`).catch(() => []);
    const n = files.filter((x) => !x.isFolder).length;
    if (n) out.set(f.day, (out.get(f.day) ?? 0) + n);
  }
  return out;
}

export async function getRecordings(circle: PaathCircle, day: string): Promise<Recording[]> {
  const out: Recording[] = [];
  for (const f of (await dayFolders(circle)).filter((x) => x.day === day)) {
    const files = await listOrgFiles(ORG, `${circle.folder}/${PAATH_RECORDINGS}/${f.name}`).catch(() => []);
    for (const x of files.filter((y) => !y.isFolder)) out.push({ name: x.name, href: fileHref(x.url), size: x.size, at: x.lastModified });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const AUDIO_EXT: Record<string, string> = { "audio/webm": "webm", "video/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "video/mp4": "m4a", "audio/mpeg": "mp3" };
export const RECORDING_TYPES = Object.keys(AUDIO_EXT);

/** Save a reading recorded in the browser into today's folder. */
export async function saveRecording(circle: PaathCircle, viewer: Viewer, bytes: Uint8Array, mime: string, startedAt: Date): Promise<Recording | null> {
  const ext = AUDIO_EXT[mime.split(";")[0]] ?? "webm";
  const day = dayOf(startedAt);
  const target = await ensureDayFolder(circle, day);
  const [me] = await db<{ name: string }[]>`SELECT COALESCE(display_name, split_part(email, '@', 1)) AS name FROM users WHERE id = ${viewer.userId}`;
  const time = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(startedAt).replace(":", "h");
  const who = (me?.name ?? "reader").replace(/[^\p{L}\p{N} ._-]+/gu, "").trim().slice(0, 40) || "reader";
  const name = `${time} ${who} reading.${ext}`;
  if (!(await davPut(`${target}/${name}`, bytes, mime.split(";")[0]))) return null;
  return { name, href: fileHref(`/api/media/${target}/${name}`), size: bytes.byteLength, at: new Date().toISOString() };
}

// ── The Talk room: record a call, and file what it recorded ─────────────────

async function ocs<T>(method: "GET" | "POST" | "DELETE", path: string, body?: Record<string, unknown>): Promise<{ status: number; data: T | null }> {
  if (!NEXTCLOUD_URL || !NEXTCLOUD_USER) return { status: 0, data: null };
  const auth = Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}`).toString("base64");
  const res = await fetch(`${NEXTCLOUD_URL}/ocs/v2.php/apps/spreed/api/${path}?format=json`, {
    method,
    headers: { Authorization: `Basic ${auth}`, "OCS-APIRequest": "true", Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json().catch(() => null)) as { ocs?: { data?: T } } | null;
  return { status: res.status, data: json?.ocs?.data ?? null };
}

export interface CallState {
  available: boolean;
  inCall: boolean;
  people: number;
  recording: boolean;
}

// Talk's Room::RECORDING_* values: 0 none, 1 video, 2 audio, 3/4 starting, 5 failed.
export async function getCallState(circle: PaathCircle): Promise<CallState> {
  if (!circle.talkToken) return { available: false, inCall: false, people: 0, recording: false };
  const room = await ocs<{ hasCall?: boolean; callRecording?: number }>("GET", `v4/room/${circle.talkToken}`).catch(() => ({ status: 0, data: null }));
  if (!room.data) return { available: false, inCall: false, people: 0, recording: false };
  let people = 0;
  if (room.data.hasCall) {
    const list = await ocs<Array<{ actorType: string; actorId: string; inCall: number }>>("GET", `v4/room/${circle.talkToken}/participants`).catch(() => ({ status: 0, data: null }));
    people = (list.data ?? []).filter((p) => p.inCall > 0 && !(p.actorType === "users" && p.actorId === NEXTCLOUD_USER)).length;
  }
  const rec = room.data.callRecording ?? 0;
  return { available: true, inCall: Boolean(room.data.hasCall), people, recording: rec >= 1 && rec <= 4 };
}

/** Start (audio) or stop recording the call. Talk keeps the file in the service account's Talk/Recording/<token>/. */
export async function setCallRecording(circle: PaathCircle, on: boolean): Promise<{ ok: boolean; message: string }> {
  if (!circle.talkToken) return { ok: false, message: "This reading has no Talk room." };
  const res = on
    ? await ocs("POST", `v1/recording/${circle.talkToken}`, { status: 2 })
    : await ocs("DELETE", `v1/recording/${circle.talkToken}`);
  if (res.status === 200) return { ok: true, message: on ? "Recording the call." : "Recording stopped; it will appear in today’s entry in a few minutes." };
  if (on && res.status === 400) return { ok: false, message: "Join the call first — Talk records only a call in progress." };
  return { ok: false, message: `Talk answered ${res.status || "nothing"}.` };
}

/**
 * Move finished call recordings (unchanged for 3 minutes) into the folder of
 * the day they were made. Runs when the page is opened; cheap when there is
 * nothing to move.
 */
export async function fileCallRecordings(circle: PaathCircle): Promise<number> {
  if (!circle.talkToken) return 0;
  const files = (await davList(`Talk/Recording/${circle.talkToken}`).catch(() => [])).filter((f) => !f.isFolder);
  let moved = 0;
  for (const f of files) {
    const written = f.lastModified ? new Date(f.lastModified) : null;
    if (!written || Date.now() - written.getTime() < 3 * 60_000) continue;
    const target = await ensureDayFolder(circle, dayOf(written));
    if (await davMove(f.path, `${target}/Talk call ${f.name}`)) moved++;
  }
  return moved;
}
