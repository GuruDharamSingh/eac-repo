// ============================================================================
// WORKSPACES — read-only reads for Sophia's /workspaces (slice 1, 2026-11-22).
//
// A workspace is a course plus one group run (mode cohort or circle). Nothing here writes, and nothing
// here reads what anyone WROTE (responses stay behind record.ts's visibility rules). The roster is staff only.
// ============================================================================
import { db } from '@elkdonis/db';
import type { Course, LmsViewer, PublishedCourse, ResponseKind, ResponseVisibility, Run, RunMode, StepStatus } from './types';
import { getCourseBySlug, getCourseVersion } from './content';
import { enrol, getEnrolment, getRun, hasRunGuides, listRoster, listRunGuides, type RosterRow } from './delivery';
import { acknowledge, buildOutline, completeStep, saveResponse, type AcknowledgeResult } from './record';
import { isOrgStaff, newId } from './util';

const GROUP_MODES: RunMode[] = ['cohort', 'circle'];

interface RunRow {
  id: string; title: string; mode: RunMode; status: Run['status']; starts_at: Date | null; ends_at: Date | null;
  org_id: string; org_name: string; course_id: string; course_slug: string; course_title: string; course_summary: string | null;
  enrolled: number; seated: boolean; run_guide: boolean;
}

/** Group runs (never the automatic own-pace one), each flagged for this viewer. Optionally for one course. */
async function groupRuns(userId: string, courseId?: string): Promise<RunRow[]> {
  return db<RunRow[]>`
    SELECT r.id, r.title, r.mode, r.status, r.starts_at, r.ends_at, r.org_id, o.name AS org_name,
           c.id AS course_id, c.slug AS course_slug, c.title AS course_title, c.summary AS course_summary,
           (SELECT COUNT(*)::int FROM lms_enrolments e WHERE e.run_id = r.id AND e.status <> 'withdrawn') AS enrolled,
           EXISTS (SELECT 1 FROM lms_enrolments e WHERE e.run_id = r.id AND e.user_id = ${userId} AND e.status <> 'withdrawn') AS seated,
           EXISTS (SELECT 1 FROM lms_run_staff s WHERE s.run_id = r.id AND s.user_id = ${userId}) AS run_guide
    FROM lms_runs r
    JOIN lms_courses c ON c.id = r.course_id
    JOIN organizations o ON o.id = r.org_id
    WHERE r.mode IN ${db(GROUP_MODES)} AND NOT r.is_default AND r.status <> 'archived' AND c.archived_at IS NULL
      ${courseId ? db`AND c.id = ${courseId}` : db``}
    ORDER BY (r.status = 'open') DESC, r.starts_at NULLS LAST, r.created_at
  `;
}

export interface WorkspaceListItem {
  runId: string; runTitle: string; mode: RunMode; status: Run['status'];
  startsAt: Date | null; endsAt: Date | null;
  courseSlug: string; courseTitle: string; courseSummary: string | null;
  orgId: string; orgName: string; enrolled: number;
}
const toItem = (r: RunRow): WorkspaceListItem => ({
  runId: r.id, runTitle: r.title, mode: r.mode, status: r.status, startsAt: r.starts_at, endsAt: r.ends_at,
  courseSlug: r.course_slug, courseTitle: r.course_title, courseSummary: r.course_summary,
  orgId: r.org_id, orgName: r.org_name, enrolled: r.enrolled,
});

/**
 * The viewer's workspaces: `member` = group runs where they hold a seat that is not withdrawn;
 * `guiding` = group runs they are named on, or whose organisation they own or guide (isOrgStaff).
 * A run can appear in both.
 */
export async function listWorkspaces(viewer: LmsViewer): Promise<{ member: WorkspaceListItem[]; guiding: WorkspaceListItem[] }> {
  if (!viewer.userId) return { member: [], guiding: [] };
  const rows = await groupRuns(viewer.userId);
  return {
    member: rows.filter((r) => r.seated).map(toItem),
    guiding: rows.filter((r) => r.run_guide || isOrgStaff(viewer, r.org_id)).map(toItem),
  };
}

export interface WorkspaceView {
  course: Course;
  /** The group run shown; null when the course has none yet. */
  run: Run | null;
  /** That run's pinned published version; null when there is none (or the run is missing). */
  published: PublishedCourse | null;
  /** Owner or guide of the organisation, or named on the run. */
  isStaff: boolean;
  /** Named on this run (lms_run_staff): the only role that reads guide-visible entries. Org staff and admins are not, by their role. */
  runGuide: boolean;
  /** The viewer holds a seat in `run`. */
  seated: boolean;
  /** Named guides of the run. No emails. */
  guides: Array<{ id: string; name: string; avatarUrl: string | null }>;
  /** Everyone seated, for staff only; null for anyone else. */
  roster: RosterRow[] | null;
}

/**
 * One workspace by course slug, for this viewer. Null (so the host shows its normal not-found) when the course does not
 * exist, the viewer is signed out, or the viewer is neither seated in a group run of it nor staff.
 * Which run: the one they hold a seat in, else one they guide, else the first group run. A course with no group run
 * (staff only) or no published version still answers, with `run` or `published` null.
 */
export async function getWorkspaceView(viewer: LmsViewer, courseSlug: string): Promise<WorkspaceView | null> {
  if (!viewer.userId) return null;
  const course = await getCourseBySlug(courseSlug);
  if (!course) return null;
  const orgStaff = isOrgStaff(viewer, course.orgId);
  const rows = await groupRuns(viewer.userId, course.id);
  const mine = rows.find((r) => r.seated) ?? rows.find((r) => r.run_guide) ?? (orgStaff ? rows[0] : undefined);
  if (!mine && !orgStaff) return null;

  const run = mine ? await getRun(mine.id) : null;
  // A version that cannot be read (for example an outline stored as text) means "nothing to show", never a crash.
  const published = run ? await getCourseVersion(course, run.courseVersionId).catch(() => null) : null;
  const seated = run ? Boolean(await getEnrolment(viewer.userId, run.id).then((e) => e && e.status !== 'withdrawn')) : false;
  const isStaff = orgStaff || Boolean(mine?.run_guide);
  const guides = run ? (await listRunGuides(run.id)).map((g) => ({ id: g.id, name: g.name, avatarUrl: g.avatarUrl })) : [];
  const roster = run && isStaff ? await listRoster(viewer, run.id) : null;
  return { course, run, published, isStaff, seated, runGuide: Boolean(mine?.run_guide), guides, roster };
}

// ── doing steps (slice 3a) ──────────────────────────────────────────────────
// A SEATED, NON-STAFF participant does steps inside the workspace through the engine's own writes
// (completeStep, saveResponse). Everything read here is the viewer's OWN: never anyone else's words.

/**
 * May this viewer do steps here? With something published, and either seated in the group run and not staff (a participant),
 * or NAMED on this run as a guide (they take part too, and are seated through the engine when they first write).
 * Org owners/guides and network admins who are not named on the run stay readers and gain no reading power.
 */
export const canDoSteps = (v: WorkspaceView): boolean => Boolean(v.run && v.published && ((v.seated && !v.isStaff) || v.runGuide));

export interface WorkspaceDoing {
  enrolmentId: string;
  /** Per step: may it be opened now (the engine's unlock rules), and why not. */
  access: Record<string, { allowed: boolean; reason: string | null }>;
  /** Step ids completed (or waived). */
  done: string[];
  /** The viewer's own reflections and practice logs. Notes to the guide are left out. */
  responses: Array<{ id: string; stepId: string; kind: Exclude<ResponseKind, 'note'>; body: string; visibility: ResponseVisibility; createdAt: Date; updatedAt: Date }>;
  /** Who may be shown a new entry: the same choices Sophia's step page offers (never "public" here). */
  visChoices: Array<Exclude<ResponseVisibility, 'public'>>;
  defaultVisibility: Exclude<ResponseVisibility, 'public'>;
}

export async function getWorkspaceDoing(viewer: LmsViewer, view: WorkspaceView): Promise<WorkspaceDoing | null> {
  if (!viewer.userId || !canDoSteps(view) || !view.run || !view.published) return null;
  const found = await getEnrolment(viewer.userId, view.run.id);
  // A named guide who has no seat yet reads an empty state (nothing done); the seat is made when they first write (doingFor with seat).
  const enrolment = found && found.status !== 'withdrawn' ? found : null;
  if (!enrolment && !view.runGuide) return null;
  const rows = enrolment ? await db<Array<{ step_id: string; status: StepStatus }>>`SELECT step_id, status FROM lms_step_state WHERE enrolment_id = ${enrolment.id}` : [];
  const status = Object.fromEntries(rows.map((r) => [r.step_id, r.status]));
  const outline = buildOutline(view.published, view.run, enrolment, status, false);
  const ong = await ongoingAvailable();
  const mine = enrolment ? await db<Array<{ id: string; step_id: string; kind: Exclude<ResponseKind, 'note'>; body: string; visibility: ResponseVisibility; created_at: Date; updated_at: Date }>>`
    SELECT id, step_id, kind, body, visibility, created_at, updated_at FROM lms_responses
    WHERE enrolment_id = ${enrolment.id} AND user_id = ${viewer.userId} AND kind <> 'note' ${ong ? db`AND interval_key IS NULL` : db``} ORDER BY created_at
  ` : [];
  const community = view.run.mode === 'cohort' || view.run.mode === 'circle';
  const guided = await hasRunGuides(view.run.id);
  const visChoices: WorkspaceDoing['visChoices'] = ['me', ...(guided ? (['guide'] as const) : []), ...(community ? (['circle'] as const) : [])];
  const dv = view.run.defaultVisibility;
  return {
    enrolmentId: enrolment?.id ?? '',
    access: Object.fromEntries(outline.steps.map((s) => [s.stepId, { allowed: s.access.allowed, reason: s.access.reason }])),
    done: outline.steps.filter((s) => s.status === 'completed' || s.status === 'waived').map((s) => s.stepId),
    responses: mine.map((r) => ({ id: r.id, stepId: r.step_id, kind: r.kind, body: r.body, visibility: r.visibility, createdAt: r.created_at, updatedAt: r.updated_at })),
    visChoices,
    defaultVisibility: visChoices.includes(dv as never) ? (dv as WorkspaceDoing['defaultVisibility']) : 'me',
  };
}

export type WorkspaceDoResult = { ok: true; doing: WorkspaceDoing; responseId?: string } | { ok: false; error: string };

export async function doingFor(viewer: LmsViewer, courseSlug: string, opts: { seat?: boolean } = {}) {
  let view = await getWorkspaceView(viewer, courseSlug);
  if (!view || !canDoSteps(view) || !view.run) return null;
  // A guide named on the run takes part like anyone: their responses hang on a seat (the engine keys them on an enrolment),
  // which the engine's own enrol() makes the first time they WRITE (never when they only look). Staff who are not named never reach here.
  if (opts.seat && view.runGuide && !view.seated) {
    const seat = await enrol(viewer, view.run.id);
    if (seat.ok === false) return null;
    view = await getWorkspaceView(viewer, courseSlug);
    if (!view || !canDoSteps(view) || !view.run) return null;
  }
  // In an experiment a seat writes only once its person has agreed to the current consent text (and not withdrawn).
  // A named guide is exempt from that gate; their entries still reach a result only through the same per-entry agreement and a consent row, like anyone's.
  if (!view.runGuide && !(await participationOk(view.run.id, viewer.userId!))) return null;
  const doing = await getWorkspaceDoing(viewer, view);
  return doing ? { view, doing } : null;
}

/** Mark one step complete: the engine's own completeStep (unlock rules and all). */
export async function completeWorkspaceStep(viewer: LmsViewer, courseSlug: string, stepId: string): Promise<WorkspaceDoResult> {
  const d = await doingFor(viewer, courseSlug, { seat: true });
  if (!d) return { ok: false, error: 'This workspace is read only for you.' };
  const r = await completeStep(viewer, d.doing.enrolmentId, stepId);
  if (r.ok === false) return { ok: false, error: r.error };
  const again = await doingFor(viewer, courseSlug);
  return again ? { ok: true, doing: again.doing } : { ok: false, error: 'Saved, but the page could not be refreshed.' };
}

/** Keep one reflection or practice log (or change one of your own): the engine's own saveResponse. */
export async function saveWorkspaceResponse(
  viewer: LmsViewer, courseSlug: string,
  input: { stepId: string; kind: 'reflection' | 'practice_log'; body: string; visibility?: ResponseVisibility; responseId?: string },
): Promise<WorkspaceDoResult> {
  const d = await doingFor(viewer, courseSlug, { seat: true });
  if (!d) return { ok: false, error: 'This workspace is read only for you.' };
  const vis = input.visibility && d.doing.visChoices.includes(input.visibility as never) ? input.visibility : d.doing.defaultVisibility;
  const r = await saveResponse(viewer, { enrolmentId: d.doing.enrolmentId, stepId: input.stepId, body: input.body, kind: input.kind, visibility: vis, responseId: input.responseId });
  if (r.ok === false) return { ok: false, error: r.error };
  const again = await doingFor(viewer, courseSlug);
  return again ? { ok: true, doing: again.doing, responseId: r.responseId } : { ok: false, error: 'Saved, but the page could not be refreshed.' };
}

// ── the shared journal (slice 5) ────────────────────────────────────────────
// EVERY read of other people's words in a workspace goes through listRunJournal. It enforces each response's OWN
// visibility, in the query (never in a screen):
//   - your own entries: always (every visibility);
//   - `circle` entries: anyone seated in this run, and the guides named on it;
//   - `guide` entries: only the guides named on this run (lms_run_staff);
//   - `me` entries of anyone else: never, for any role. `public` and notes (to the guide): never in this feed.
// Org owners/guides and network admins get NO extra reading power from their role: only a seat or a name on the run counts.
// The author's seat must not be withdrawn for their entries to reach others.

export interface RunJournalComment {
  id: string;
  /** "viewer" for the reader's own, a guide's user id, or the commenter's seat id. */
  by: string;
  byName: string;
  byGuide: boolean;
  body: string;
  createdAt: Date;
  /** A guide's answer (lms_acknowledgements) or a member's comment (lms_response_comments). */
  kind: 'answer' | 'comment';
}
export interface RunJournalEntry {
  id: string;
  stepId: string;
  kind: Exclude<ResponseKind, 'note'>;
  body: string;
  visibility: ResponseVisibility;
  createdAt: Date;
  updatedAt: Date;
  mine: boolean;
  /** "viewer" when mine; the author's user id for a named guide; otherwise the author's seat id (never a user id). */
  authorKey: string;
  authorName: string;
  authorIsGuide: boolean;
  comments: RunJournalComment[];
}
export interface RunJournal {
  entries: RunJournalEntry[];
  /** `everyone`: members may comment (needs migration 284). `guide`: only guide answers. */
  commentsMode: 'everyone' | 'guide';
  /** The viewer is named on the run: may answer, and reads guide-visible entries. */
  isGuide: boolean;
}

/** True once migration 284 is applied. */
export async function commentsTableExists(): Promise<boolean> {
  const [r] = await db<Array<{ t: string | null }>>`SELECT to_regclass('public.lms_response_comments')::text AS t`;
  return Boolean(r?.t);
}

interface JRow {
  id: string; step_id: string; kind: Exclude<ResponseKind, 'note'>; body: string; visibility: ResponseVisibility; created_at: Date; updated_at: Date;
  user_id: string; enrolment_id: string; author_name: string | null; author_guide: boolean;
  acks: Array<{ id: string; by: string; byName: string; body: string | null; at: string }> | null;
}

export async function journalAccess(viewer: LmsViewer, runId: string): Promise<{ seated: boolean; isGuide: boolean }> {
  if (!viewer.userId) return { seated: false, isGuide: false };
  const [r] = await db<Array<{ seated: boolean; guide: boolean }>>`
    SELECT EXISTS (SELECT 1 FROM lms_enrolments e WHERE e.run_id = ${runId} AND e.user_id = ${viewer.userId} AND e.status <> 'withdrawn') AS seated,
           EXISTS (SELECT 1 FROM lms_run_staff s WHERE s.run_id = ${runId} AND s.user_id = ${viewer.userId}) AS guide
  `;
  const guide = Boolean(r?.guide);
  // An unconsented seat in an experiment reads and writes nothing of the group's.
  const seated = Boolean(r?.seated) && (guide || (await participationOk(runId, viewer.userId)));
  return { seated, isGuide: guide };
}

/** The journal of one run, as this viewer may read it. Null when the viewer is neither seated in the run nor named on it. */
export async function listRunJournal(viewer: LmsViewer, runId: string): Promise<RunJournal | null> {
  const me = viewer.userId;
  if (!me) return null;
  const { seated, isGuide } = await journalAccess(viewer, runId);
  if (!seated && !isGuide) return null;
  const guideOk = isGuide ? db`TRUE` : db`FALSE`;
  const ongJ = await ongoingAvailable();
  const rows = await db<JRow[]>`
    SELECT r.id, r.step_id, r.kind, r.body, r.visibility, r.created_at, r.updated_at, r.user_id, r.enrolment_id,
           u.display_name AS author_name,
           EXISTS (SELECT 1 FROM lms_run_staff s WHERE s.run_id = r.run_id AND s.user_id = r.user_id) AS author_guide,
           (SELECT json_agg(json_build_object('id', a.id, 'by', a.guide_id, 'byName', COALESCE(g.display_name, 'Your guide'), 'body', a.body, 'at', a.created_at) ORDER BY a.created_at)
              FROM lms_acknowledgements a JOIN users g ON g.id = a.guide_id WHERE a.response_id = r.id AND a.body IS NOT NULL) AS acks
    FROM lms_responses r
    JOIN users u ON u.id = r.user_id
    JOIN lms_enrolments en ON en.id = r.enrolment_id
    WHERE r.run_id = ${runId} AND r.kind <> 'note'
      AND (
        r.user_id = ${me}
        OR (en.status <> 'withdrawn' AND (r.visibility = 'circle' OR (r.visibility = 'guide' AND ${guideOk})))
      )
      ${ongJ ? db`AND (r.interval_key IS NULL OR r.user_id = ${me} OR ${guideOk})` : db``}
    ORDER BY r.created_at DESC LIMIT 500
  `;
  const hasTable = await commentsTableExists();
  const byResp = new Map<string, RunJournalComment[]>();
  const push = (rid: string, c: RunJournalComment) => { const a = byResp.get(rid) ?? []; a.push(c); byResp.set(rid, a); };
  for (const r of rows) {
    for (const a of r.acks ?? []) push(r.id, { id: a.id, by: a.by === me ? 'viewer' : a.by, byName: a.byName, byGuide: true, body: a.body ?? '', createdAt: new Date(a.at), kind: 'answer' });
  }
  if (hasTable && rows.length) {
    const cs = await db<Array<{ id: string; response_id: string; user_id: string; body: string; created_at: Date; name: string | null; guide: boolean; seat: string | null }>>`
      SELECT c.id, c.response_id, c.user_id, c.body, c.created_at, u.display_name AS name,
             EXISTS (SELECT 1 FROM lms_run_staff s WHERE s.run_id = ${runId} AND s.user_id = c.user_id) AS guide,
             (SELECT e.id FROM lms_enrolments e WHERE e.run_id = ${runId} AND e.user_id = c.user_id LIMIT 1) AS seat
      FROM lms_response_comments c JOIN users u ON u.id = c.user_id
      WHERE c.response_id IN ${db(rows.map((r) => r.id))} AND c.deleted_at IS NULL ORDER BY c.created_at
    `;
    for (const c of cs) {
      push(c.response_id, { id: c.id, by: c.user_id === me ? 'viewer' : c.guide ? c.user_id : c.seat ?? 'someone', byName: c.name ?? 'Someone', byGuide: c.guide, body: c.body, createdAt: c.created_at, kind: 'comment' });
    }
  }
  const entries = rows.map((r): RunJournalEntry => {
    const mine = r.user_id === me;
    return {
      id: r.id, stepId: r.step_id, kind: r.kind, body: r.body, visibility: r.visibility, createdAt: r.created_at, updatedAt: r.updated_at,
      mine, authorKey: mine ? 'viewer' : r.author_guide ? r.user_id : r.enrolment_id, authorName: r.author_name ?? 'Someone', authorIsGuide: r.author_guide,
      comments: (byResp.get(r.id) ?? []).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    };
  });
  return { entries, commentsMode: hasTable ? 'everyone' : 'guide', isGuide };
}

/** The journal of a workspace by course slug (the run is chosen as getWorkspaceView chooses it). */
export async function getWorkspaceJournal(viewer: LmsViewer, courseSlug: string): Promise<RunJournal | null> {
  const view = await getWorkspaceView(viewer, courseSlug);
  if (!view?.run) return null;
  return listRunJournal(viewer, view.run.id);
}

export type JournalWriteResult = { ok: true; journal: RunJournal; notify?: AcknowledgeResult; changed?: number } | { ok: false; error: string };

async function refreshed(viewer: LmsViewer, courseSlug: string, extra: { notify?: AcknowledgeResult; changed?: number } = {}): Promise<JournalWriteResult> {
  const journal = await getWorkspaceJournal(viewer, courseSlug);
  return journal ? { ok: true, journal, ...extra } : { ok: false, error: 'Saved, but the journal could not be refreshed.' };
}

/** Change who may read one of your own entries (the engine's saveResponse, so its rules apply). */
export async function setWorkspaceEntryVisibility(viewer: LmsViewer, courseSlug: string, responseId: string, visibility: ResponseVisibility): Promise<JournalWriteResult> {
  const d = await doingFor(viewer, courseSlug);
  if (!d) return { ok: false, error: 'This workspace is read only for you.' };
  const [own] = await db<Array<{ step_id: string; kind: Exclude<ResponseKind, 'note'>; body: string }>>`
    SELECT step_id, kind, body FROM lms_responses WHERE id = ${responseId} AND user_id = ${viewer.userId} AND enrolment_id = ${d.doing.enrolmentId} AND kind <> 'note'
  `;
  if (!own) return { ok: false, error: 'That isn’t yours to change.' };
  if (!d.doing.visChoices.includes(visibility as never)) return { ok: false, error: 'That choice isn’t offered here.' };
  const r = await saveResponse(viewer, { enrolmentId: d.doing.enrolmentId, stepId: own.step_id, body: own.body, kind: own.kind, visibility, responseId });
  if (r.ok === false) return { ok: false, error: r.error };
  return refreshed(viewer, courseSlug);
}

/** One press: every entry you have written in this workspace goes back to "only me". Others lose sight of them at once. */
export async function makeMyWorkspaceEntriesPrivate(viewer: LmsViewer, courseSlug: string): Promise<JournalWriteResult> {
  const d = await doingFor(viewer, courseSlug);
  if (!d) return { ok: false, error: 'This workspace is read only for you.' };
  const rows = await db<Array<{ id: string }>>`
    UPDATE lms_responses SET visibility = 'me'
    WHERE enrolment_id = ${d.doing.enrolmentId} AND user_id = ${viewer.userId} AND kind <> 'note' AND visibility <> 'me' RETURNING id
  `;
  return refreshed(viewer, courseSlug, { changed: rows.length });
}

/** A guide answers an entry (the engine's acknowledge: only guides named on the run, never a `me` entry). */
export async function answerWorkspaceEntry(viewer: LmsViewer, courseSlug: string, responseId: string, body: string): Promise<JournalWriteResult> {
  const view = await getWorkspaceView(viewer, courseSlug);
  if (!view?.run || !view.runGuide) return { ok: false, error: 'Only the guides of this group answer.' };
  const [ok] = await db`SELECT 1 FROM lms_responses WHERE id = ${responseId} AND run_id = ${view.run.id}`;
  if (!ok) return { ok: false, error: 'That entry isn’t in this group.' };
  const r = await acknowledge(viewer, responseId, { body });
  if (r.ok === false) return { ok: false, error: r.error };
  return refreshed(viewer, courseSlug, { notify: r.notify });
}

/**
 * A member comments on an entry they can read. Needs migration 284 (a plain refusal until then). The reader must pass the
 * same visibility test as listRunJournal for THAT entry; guides use answerWorkspaceEntry instead.
 */
export async function commentOnWorkspaceEntry(viewer: LmsViewer, courseSlug: string, responseId: string, body: string): Promise<JournalWriteResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: 'Write a few words first.' };
  if (text.length > 2000) return { ok: false, error: 'That is longer than a comment can be.' };
  if (!(await commentsTableExists())) return { ok: false, error: 'Comments from the group are not switched on yet. Your guide can answer.' };
  const view = await getWorkspaceView(viewer, courseSlug);
  if (!view?.run || !viewer.userId) return { ok: false, error: 'Not available.' };
  const run = view.run;
  const { seated, isGuide } = await journalAccess(viewer, run.id);

  if (!seated && !isGuide) return { ok: false, error: 'Only people in the group comment.' };
  const [r] = await db<Array<{ org_id: string }>>`
    SELECT r.org_id FROM lms_responses r JOIN lms_enrolments en ON en.id = r.enrolment_id
    WHERE r.id = ${responseId} AND r.run_id = ${run.id} AND r.kind <> 'note'
      AND (r.user_id = ${viewer.userId} OR (en.status <> 'withdrawn' AND (r.visibility = 'circle' OR (r.visibility = 'guide' AND ${isGuide ? db`TRUE` : db`FALSE`}))))
  `;
  if (!r) return { ok: false, error: 'You cannot comment on that one.' };
  await db`INSERT INTO lms_response_comments (id, response_id, user_id, org_id, body) VALUES (${newId()}, ${responseId}, ${viewer.userId}, ${r.org_id}, ${text})`;
  return refreshed(viewer, courseSlug);
}

/** The participant's fresh doing state (after something moved between private and shared). */
export async function refreshWorkspaceDoing(viewer: LmsViewer, courseSlug: string): Promise<WorkspaceDoResult> {
  const d = await doingFor(viewer, courseSlug);
  return d ? { ok: true, doing: d.doing } : { ok: false, error: 'This workspace is read only for you.' };
}

// ── ongoing sessions: are the tables there? (migration 285) ─────────────────
let ongoingCache: { at: number; ok: boolean } | null = null;
/** True once migration 285 exists (workspace_cadences, workspace_materials, the two columns). Cached for 20 s. Ongoing stays hidden until then. */
export async function ongoingAvailable(): Promise<boolean> {
  if (ongoingCache && Date.now() - ongoingCache.at < 20_000) return ongoingCache.ok;
  let ok = false;
  try {
    const [r] = await db<Array<{ ok: boolean }>>`
      SELECT to_regclass('public.workspace_cadences') IS NOT NULL AND to_regclass('public.workspace_materials') IS NOT NULL
         AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lms_responses' AND column_name = 'interval_key')
         AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lms_enrolments' AND column_name = 'tz') AS ok
    `;
    ok = Boolean(r?.ok);
  } catch {
    ok = false;
  }
  ongoingCache = { at: Date.now(), ok };
  return ok;
}

/** Guide answers and members' comments for some responses, as the journal reads them. The caller has already decided the responses are readable. */
export async function commentsFor(ids: string[], runId: string, me: string): Promise<Map<string, RunJournalComment[]>> {
  const byResp = new Map<string, RunJournalComment[]>();
  if (!ids.length) return byResp;
  const push = (rid: string, c: RunJournalComment) => { const a = byResp.get(rid) ?? []; a.push(c); byResp.set(rid, a); };
  const acks = await db<Array<{ id: string; response_id: string; guide_id: string; name: string | null; body: string; created_at: Date }>>`
    SELECT a.id, a.response_id, a.guide_id, g.display_name AS name, a.body, a.created_at
    FROM lms_acknowledgements a JOIN users g ON g.id = a.guide_id WHERE a.response_id IN ${db(ids)} AND a.body IS NOT NULL ORDER BY a.created_at
  `;
  for (const a of acks) push(a.response_id, { id: a.id, by: a.guide_id === me ? 'viewer' : a.guide_id, byName: a.name ?? 'Your guide', byGuide: true, body: a.body, createdAt: a.created_at, kind: 'answer' });
  if (await commentsTableExists()) {
    const cs = await db<Array<{ id: string; response_id: string; user_id: string; body: string; created_at: Date; name: string | null; guide: boolean; seat: string | null }>>`
      SELECT c.id, c.response_id, c.user_id, c.body, c.created_at, u.display_name AS name,
             EXISTS (SELECT 1 FROM lms_run_staff s WHERE s.run_id = ${runId} AND s.user_id = c.user_id) AS guide,
             (SELECT e.id FROM lms_enrolments e WHERE e.run_id = ${runId} AND e.user_id = c.user_id LIMIT 1) AS seat
      FROM lms_response_comments c JOIN users u ON u.id = c.user_id
      WHERE c.response_id IN ${db(ids)} AND c.deleted_at IS NULL ORDER BY c.created_at
    `;
    for (const c of cs) push(c.response_id, { id: c.id, by: c.user_id === me ? 'viewer' : c.guide ? c.user_id : c.seat ?? 'someone', byName: c.name ?? 'Someone', byGuide: c.guide, body: c.body, createdAt: c.created_at, kind: 'comment' });
  }
  for (const list of byResp.values()) list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return byResp;
}

/**
 * May this person take part? Always yes in an ordinary workspace. In an experiment (migration 288): only with a consent row for the
 * CURRENT wording that has not been withdrawn. Fails soft: where the tables do not exist, everyone may.
 */
export async function participationOk(runId: string, userId: string): Promise<boolean> {
  try {
    const [r] = await db<Array<{ preset: string | null; latest: number | null; given: number | null }>>`
      SELECT (SELECT ws.preset FROM workspace_settings ws WHERE ws.host_type = 'lms_run' AND ws.host_id = ${runId}) AS preset,
             (SELECT MAX(t.version) FROM workspace_consent_texts t WHERE t.host_type = 'lms_run' AND t.host_id = ${runId}) AS latest,
             (SELECT c.text_version FROM workspace_consents c WHERE c.host_type = 'lms_run' AND c.host_id = ${runId} AND c.user_id = ${userId} AND c.withdrawn_at IS NULL) AS given
    `;
    if (r?.preset !== 'experiment') return true;
    return r.given !== null && r.latest !== null && r.given === r.latest;
  } catch {
    return true;
  }
}
