// ============================================================================
// RECORD layer — state, responses, acknowledgement, events, awards.
//
// lms_step_state is what the UI reads; lms_events is written in the same
// transaction. What people WRITE is in lms_responses and is only ever read
// through the visibility rules in this file.
// ============================================================================
import { db } from '@elkdonis/db';
import type {
  Enrolment, LearnerOutline, LmsResponse, LmsViewer, OutlineStepView, PublishedCourse, PublishedStep,
  ResponseKind, ResponseVisibility, Run, StepStatus, WriteResult,
} from './types';
import { getCourseById, getCourseVersion } from './content';
import { ensureDefaultRun, getActiveEnrolment, getRun, isRunStaff } from './delivery';
import { evaluateAccess } from './unlock';
import { stepTypeDef } from './step-types';
import { newId } from './util';

// ── the learner's view of a course ──────────────────────────────────────────
async function statusMap(enrolmentId: string): Promise<Record<string, StepStatus>> {
  const rows = await db<Array<{ step_id: string; status: StepStatus }>>`SELECT step_id, status FROM lms_step_state WHERE enrolment_id = ${enrolmentId}`;
  return Object.fromEntries(rows.map((r) => [r.step_id, r.status]));
}

export function buildOutline(pc: PublishedCourse, run: Run, enrolment: Enrolment | null, status: Record<string, StepStatus>, bypass: boolean, now = new Date()): LearnerOutline {
  const ctx = { steps: pc.steps, status, anchorAt: enrolment?.anchorAt ?? null, now, bypass };
  const view = (s: PublishedStep): OutlineStepView => ({ ...s, status: status[s.stepId] ?? null, access: evaluateAccess(s, ctx) });
  const steps = pc.steps.map(view);
  const byId = new Map(steps.map((s) => [s.stepId, s]));
  const isDone = (s: OutlineStepView) => s.status === 'completed' || s.status === 'waived';
  const required = steps.filter((s) => s.required);
  return {
    run, enrolment,
    modules: pc.modules.map((m) => ({ id: m.id, title: m.title, summary: m.summary, steps: m.steps.map((s) => byId.get(s.stepId)!) })),
    steps,
    // Required work first; optional steps never hold "Continue" back.
    continueStep: steps.find((s) => s.required && !isDone(s) && s.access.allowed) ?? null,
    doneRequired: required.filter(isDone).length,
    totalRequired: required.length,
  };
}

/**
 * Everything a course page needs for this viewer: the run they are in (or the
 * default one), the version THAT RUN pins, and each step's state and access.
 * Signed-out readers get the default run's version with nothing done.
 */
export async function getLearnerOutline(viewer: LmsViewer, courseSlugOrId: { courseId: string }): Promise<(LearnerOutline & { published: PublishedCourse; isStaff: boolean }) | null> {
  const course = await getCourseById(courseSlugOrId.courseId);
  if (!course?.publishedVersionId) return null;
  const enrolment = viewer.userId ? await getActiveEnrolment(viewer.userId, course.id) : null;
  const run = enrolment ? await getRun(enrolment.runId) : await ensureDefaultRun(course);
  if (!run) return null;
  const published = await getCourseVersion(course, run.courseVersionId);
  if (!published) return null;
  const isStaff = await isRunStaff(viewer, run);
  const status = enrolment ? await statusMap(enrolment.id) : {};
  return { ...buildOutline(published, run, enrolment, status, isStaff), published, isStaff };
}

// ── progress ────────────────────────────────────────────────────────────────
async function loadForWrite(viewer: LmsViewer, enrolmentId: string, stepId: string) {
  if (!viewer.userId) return { error: 'Sign in first.' } as const;
  const [e] = await db<Array<{ id: string; run_id: string; course_id: string; org_id: string; user_id: string; anchor_at: Date; status: string }>>`
    SELECT id, run_id, course_id, org_id, user_id, anchor_at, status FROM lms_enrolments WHERE id = ${enrolmentId}
  `;
  if (!e || e.user_id !== viewer.userId || e.status === 'withdrawn') return { error: 'That isn’t your place in this course.' } as const;
  const run = await getRun(e.run_id);
  const course = await getCourseById(e.course_id);
  if (!run || !course) return { error: 'No such course.' } as const;
  const published = await getCourseVersion(course, run.courseVersionId);
  const step = published?.steps.find((s) => s.stepId === stepId);
  if (!published || !step) return { error: 'That step isn’t part of this course any more.' } as const;
  return { e, run, course, published, step } as const;
}

/** Opening a step. Remembers where "Continue" should return to. Never fails loudly. */
export async function touchStep(viewer: LmsViewer, enrolmentId: string, stepId: string): Promise<void> {
  try {
    const l = await loadForWrite(viewer, enrolmentId, stepId);
    if ('error' in l) return;
    await db.begin(async (tx) => {
      const ins = await tx`
        INSERT INTO lms_step_state (enrolment_id, step_id, org_id, status, step_version_id)
        VALUES (${enrolmentId}, ${stepId}, ${l.e.org_id}, 'started', ${l.step.stepVersionId})
        ON CONFLICT DO NOTHING RETURNING step_id
      `;
      await tx`UPDATE lms_enrolments SET last_step_id = ${stepId}, last_seen_at = NOW() WHERE id = ${enrolmentId}`;
      if (ins.length) {
        await tx`INSERT INTO lms_events (org_id, actor_id, verb, object_type, object_id, object_version_id, enrolment_id)
                 VALUES (${l.e.org_id}, ${viewer.userId}, 'launched', 'step', ${stepId}, ${l.step.stepVersionId}, ${enrolmentId})`;
      }
    });
  } catch (err) {
    console.error('[lms] touchStep:', err);
  }
}

export async function completeStep(viewer: LmsViewer, enrolmentId: string, stepId: string): Promise<WriteResult<{ courseCompleted: boolean }>> {
  const l = await loadForWrite(viewer, enrolmentId, stepId);
  if ('error' in l) return { ok: false, error: l.error! };
  const status = await statusMap(enrolmentId);
  const access = evaluateAccess(l.step, { steps: l.published.steps, status, anchorAt: l.e.anchor_at, now: new Date() });
  if (!access.allowed) return { ok: false, error: access.reason ?? 'Not open yet.' };
  if (stepTypeDef(l.step.type).completion === 'response') {
    const [r] = await db`SELECT 1 FROM lms_responses WHERE enrolment_id = ${enrolmentId} AND step_id = ${stepId} AND kind = 'reflection'`;
    if (!r) return { ok: false, error: 'Write a few words first — they can stay entirely private.' };
  }
  const courseCompleted = await db.begin((tx) => markComplete(tx, viewer.userId!, l.e, l.step, l.published));
  return { ok: true, courseCompleted };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function markComplete(tx: any, userId: string, e: { id: string; org_id: string; course_id: string }, step: PublishedStep, published: PublishedCourse): Promise<boolean> {
  const changed = await tx`
    INSERT INTO lms_step_state (enrolment_id, step_id, org_id, status, step_version_id, completed_at)
    VALUES (${e.id}, ${step.stepId}, ${e.org_id}, 'completed', ${step.stepVersionId}, NOW())
    ON CONFLICT (enrolment_id, step_id) DO UPDATE
      SET status = 'completed', step_version_id = EXCLUDED.step_version_id, completed_at = NOW()
      WHERE lms_step_state.status = 'started'
    RETURNING step_id
  `;
  await tx`UPDATE lms_enrolments SET last_step_id = ${step.stepId}, last_seen_at = NOW() WHERE id = ${e.id}`;
  if (!changed.length) return false;
  await tx`INSERT INTO lms_events (org_id, actor_id, verb, object_type, object_id, object_version_id, enrolment_id)
           VALUES (${e.org_id}, ${userId}, 'completed', 'step', ${step.stepId}, ${step.stepVersionId}, ${e.id})`;

  // Course completion is DERIVED: every required step of the pinned version done.
  const requiredIds = published.steps.filter((s) => s.required).map((s) => s.stepId);
  const [{ n }] = await tx`
    SELECT COUNT(*)::int AS n FROM lms_step_state
    WHERE enrolment_id = ${e.id} AND step_id = ANY(${requiredIds}) AND status IN ('completed', 'waived')
  `;
  if (n < requiredIds.length) return false;
  const fin = await tx`UPDATE lms_enrolments SET status = 'completed', completed_at = NOW() WHERE id = ${e.id} AND completed_at IS NULL RETURNING id`;
  if (!fin.length) return false;
  await tx`INSERT INTO lms_events (org_id, actor_id, verb, object_type, object_id, object_version_id, enrolment_id)
           VALUES (${e.org_id}, ${userId}, 'completed', 'course', ${e.course_id}, ${published.versionId}, ${e.id})`;
  const achievements = await tx`SELECT id FROM lms_achievements WHERE course_id = ${e.course_id} AND criteria->>'kind' = 'course_completed'`;
  for (const a of achievements) {
    // eslint-disable-next-line no-await-in-loop
    await tx`
      INSERT INTO lms_awards (id, achievement_id, user_id, enrolment_id, evidence)
      VALUES (${newId()}, ${a.id}, ${userId}, ${e.id}, ${tx.json({ courseVersionId: published.versionId })})
      ON CONFLICT (achievement_id, user_id) DO NOTHING
    `;
  }
  return true;
}

/** A guide sets a step aside for someone. Counts as done; never scored. */
export async function waiveStep(viewer: LmsViewer, enrolmentId: string, stepId: string): Promise<WriteResult> {
  const [e] = await db<Array<{ run_id: string; org_id: string }>>`SELECT run_id, org_id FROM lms_enrolments WHERE id = ${enrolmentId}`;
  const run = e ? await getRun(e.run_id) : null;
  if (!run || !(await isRunStaff(viewer, run))) return { ok: false, error: 'Guides only.' };
  await db.begin(async (tx) => {
    await tx`
      INSERT INTO lms_step_state (enrolment_id, step_id, org_id, status, completed_at, waived_by)
      VALUES (${enrolmentId}, ${stepId}, ${e.org_id}, 'waived', NOW(), ${viewer.userId})
      ON CONFLICT (enrolment_id, step_id) DO UPDATE SET status = 'waived', completed_at = NOW(), waived_by = ${viewer.userId}
        WHERE lms_step_state.status <> 'completed'
    `;
    await tx`INSERT INTO lms_events (org_id, actor_id, verb, object_type, object_id, enrolment_id) VALUES (${e.org_id}, ${viewer.userId}, 'waived', 'step', ${stepId}, ${enrolmentId})`;
  });
  return { ok: true };
}

// ── responses ───────────────────────────────────────────────────────────────
const VIS: ResponseVisibility[] = ['me', 'guide', 'circle', 'public'];
const KINDS: ResponseKind[] = ['reflection', 'practice_log', 'note'];

export interface SaveResponseInput {
  enrolmentId: string; stepId: string; body: string; kind?: ResponseKind; visibility?: ResponseVisibility;
  /** Edit one of your own instead of adding. */
  responseId?: string;
}
export async function saveResponse(viewer: LmsViewer, input: SaveResponseInput): Promise<WriteResult<{ responseId: string; courseCompleted: boolean }>> {
  const l = await loadForWrite(viewer, input.enrolmentId, input.stepId);
  if ('error' in l) return { ok: false, error: l.error! };
  const body = input.body.trim();
  if (!body) return { ok: false, error: 'There’s nothing written yet.' };
  if (body.length > 20_000) return { ok: false, error: 'That’s longer than this box can keep.' };
  const kind = KINDS.includes(input.kind as ResponseKind) ? input.kind! : 'reflection';
  // A note is a word to the guide; it is never wider than that.
  let visibility: ResponseVisibility = kind === 'note' ? 'guide' : VIS.includes(input.visibility as ResponseVisibility) ? input.visibility! : l.run.defaultVisibility;
  // "Public" means the open web; only a public course has anywhere to show it.
  if (visibility === 'public' && l.course.visibility !== 'public') visibility = l.run.defaultVisibility;

  let courseCompleted = false;
  const id = input.responseId ?? newId();
  const result = await db.begin(async (tx) => {
    if (input.responseId) {
      const upd = await tx`
        UPDATE lms_responses SET body = ${body}, visibility = ${visibility}, updated_at = NOW()
        WHERE id = ${id} AND user_id = ${viewer.userId} RETURNING id
      `;
      if (!upd.length) return 'missing';
    } else {
      await tx`
        INSERT INTO lms_responses (id, enrolment_id, run_id, step_id, step_version_id, user_id, org_id, kind, body, visibility)
        VALUES (${id}, ${input.enrolmentId}, ${l.run.id}, ${input.stepId}, ${l.step.stepVersionId}, ${viewer.userId}, ${l.e.org_id}, ${kind}, ${body}, ${visibility})
      `;
      // The log records THAT something was written and how widely — never what.
      await tx`INSERT INTO lms_events (org_id, actor_id, verb, object_type, object_id, object_version_id, enrolment_id, result)
               VALUES (${l.e.org_id}, ${viewer.userId}, 'responded', 'step', ${input.stepId}, ${l.step.stepVersionId}, ${input.enrolmentId}, ${tx.json({ kind, visibility, responseId: id })})`;
    }
    if (kind === 'reflection' && stepTypeDef(l.step.type).completion === 'response') {
      courseCompleted = await markComplete(tx, viewer.userId!, l.e, l.step, l.published);
    }
    return 'ok';
  });
  if (result === 'missing') return { ok: false, error: 'That isn’t yours to change.' };
  return { ok: true, responseId: id, courseCompleted };
}

/** Deleting is real: the words are gone. The log keeps only that something was once written. */
export async function deleteResponse(viewer: LmsViewer, responseId: string): Promise<WriteResult> {
  if (!viewer.userId) return { ok: false, error: 'Sign in first.' };
  const del = await db`DELETE FROM lms_responses WHERE id = ${responseId} AND user_id = ${viewer.userId} RETURNING org_id, step_id, enrolment_id`;
  if (!del.length) return { ok: false, error: 'That isn’t yours to remove.' };
  await db`INSERT INTO lms_events (org_id, actor_id, verb, object_type, object_id, enrolment_id, result)
           VALUES (${del[0].org_id}, ${viewer.userId}, 'deleted', 'response', ${responseId}, ${del[0].enrolment_id}, ${db.json({ stepId: del[0].step_id })})`;
  return { ok: true };
}

interface RespRow {
  id: string; step_id: string; kind: ResponseKind; body: string; visibility: ResponseVisibility; created_at: Date; updated_at: Date;
  u_id: string; u_name: string | null; u_avatar: string | null; acks: LmsResponse['acknowledgements'] | null;
  step_title?: string; step_slug?: string; course_slug?: string; course_title?: string; run_title?: string;
}
const RESP_SELECT = db`
  r.id, r.step_id, r.kind, r.body, r.visibility, r.created_at, r.updated_at,
  u.id AS u_id, u.display_name AS u_name, u.avatar_url AS u_avatar,
  (SELECT json_agg(json_build_object('id', a.id, 'body', a.body, 'audioUrl', a.audio_url,
            'guideName', COALESCE(g.display_name, 'Your guide'), 'createdAt', a.created_at) ORDER BY a.created_at)
     FROM lms_acknowledgements a JOIN users g ON g.id = a.guide_id WHERE a.response_id = r.id) AS acks
`;
const mapResp = (r: RespRow): LmsResponse => ({
  id: r.id, stepId: r.step_id, kind: r.kind, body: r.body, visibility: r.visibility, createdAt: r.created_at, updatedAt: r.updated_at,
  author: { id: r.u_id, name: r.u_name ?? 'Someone', avatarUrl: r.u_avatar }, acknowledgements: r.acks ?? [],
});

/** Your own words on one step, every visibility. */
export async function listMyResponses(viewer: LmsViewer, enrolmentId: string, stepId: string): Promise<LmsResponse[]> {
  if (!viewer.userId) return [];
  const rows = await db<RespRow[]>`
    SELECT ${RESP_SELECT} FROM lms_responses r JOIN users u ON u.id = r.user_id
    WHERE r.enrolment_id = ${enrolmentId} AND r.step_id = ${stepId} AND r.user_id = ${viewer.userId}
    ORDER BY r.created_at
  `;
  return rows.map(mapResp);
}

export type JournalEntry = LmsResponse & { stepTitle: string; stepSlug: string; courseSlug: string; courseTitle: string };
/** Everything you have written, across courses. Yours alone. */
export async function listJournal(viewer: LmsViewer, limit = 200): Promise<JournalEntry[]> {
  if (!viewer.userId) return [];
  const rows = await db<RespRow[]>`
    SELECT ${RESP_SELECT}, s.slug AS step_slug, c.slug AS course_slug, c.title AS course_title,
           COALESCE((SELECT sv.title FROM lms_step_versions sv WHERE sv.id = r.step_version_id), s.slug) AS step_title
    FROM lms_responses r JOIN users u ON u.id = r.user_id JOIN lms_steps s ON s.id = r.step_id JOIN lms_courses c ON c.id = s.course_id
    WHERE r.user_id = ${viewer.userId} ORDER BY r.created_at DESC LIMIT ${limit}
  `;
  return rows.map((r) => ({ ...mapResp(r), stepTitle: r.step_title!, stepSlug: r.step_slug!, courseSlug: r.course_slug!, courseTitle: r.course_title! }));
}

/**
 * What the circle shared on a step: responses at `circle` or `public`, seen
 * only by people IN the same run (and its staff). This is the community
 * classroom's shared-reflection panel.
 */
export async function listCircleResponses(viewer: LmsViewer, runId: string, stepId: string): Promise<LmsResponse[]> {
  if (!viewer.userId) return [];
  const run = await getRun(runId);
  if (!run) return [];
  const [mine] = await db`SELECT 1 FROM lms_enrolments WHERE run_id = ${runId} AND user_id = ${viewer.userId} AND status <> 'withdrawn'`;
  if (!mine && !(await isRunStaff(viewer, run))) return [];
  const rows = await db<RespRow[]>`
    SELECT ${RESP_SELECT} FROM lms_responses r JOIN users u ON u.id = r.user_id
    WHERE r.run_id = ${runId} AND r.step_id = ${stepId} AND r.visibility IN ('circle', 'public') AND r.kind <> 'note'
    ORDER BY r.created_at DESC LIMIT 100
  `;
  return rows.map(mapResp);
}

/** Responses the author chose to put on the open web, for a public step page. */
export async function listPublicResponses(stepId: string, limit = 20): Promise<LmsResponse[]> {
  const rows = await db<RespRow[]>`
    SELECT ${RESP_SELECT} FROM lms_responses r JOIN users u ON u.id = r.user_id
    WHERE r.step_id = ${stepId} AND r.visibility = 'public' AND r.kind = 'reflection'
    ORDER BY r.created_at DESC LIMIT ${limit}
  `;
  return rows.map(mapResp);
}

// ── the guide ───────────────────────────────────────────────────────────────
export type GuideQueueItem = LmsResponse & { stepTitle: string; stepSlug: string; runId: string; runTitle: string; courseSlug: string };
/**
 * What people chose to show their guide (or wider) in the runs this viewer
 * guides. `me` never appears here, for anyone, including admins. Scoped to
 * runs — deliberately NOT the network-wide shape of listPendingReviews().
 */
export async function listGuideQueue(viewer: LmsViewer, opts: { courseId?: string; awaitingOnly?: boolean; limit?: number } = {}): Promise<GuideQueueItem[]> {
  if (!viewer.userId) return [];
  const staffOrgs = Object.entries(viewer.roles).filter(([, r]) => r === 'owner' || r === 'guide').map(([o]) => o);
  const rows = await db<Array<RespRow & { run_id: string }>>`
    SELECT ${RESP_SELECT}, r.run_id, run.title AS run_title, s.slug AS step_slug, c.slug AS course_slug,
           COALESCE((SELECT sv.title FROM lms_step_versions sv WHERE sv.id = r.step_version_id), s.slug) AS step_title
    FROM lms_responses r
    JOIN users u ON u.id = r.user_id JOIN lms_runs run ON run.id = r.run_id
    JOIN lms_steps s ON s.id = r.step_id JOIN lms_courses c ON c.id = s.course_id
    WHERE r.visibility <> 'me'
      AND (run.org_id = ANY(${staffOrgs}) OR EXISTS (SELECT 1 FROM lms_run_staff st WHERE st.run_id = r.run_id AND st.user_id = ${viewer.userId}))
      ${opts.courseId ? db`AND c.id = ${opts.courseId}` : db``}
      ${opts.awaitingOnly ? db`AND NOT EXISTS (SELECT 1 FROM lms_acknowledgements a WHERE a.response_id = r.id)` : db``}
    ORDER BY (r.kind = 'note') DESC, r.created_at DESC LIMIT ${opts.limit ?? 100}
  `;
  return rows.map((r) => ({ ...mapResp(r), stepTitle: r.step_title!, stepSlug: r.step_slug!, runId: r.run_id, runTitle: r.run_title!, courseSlug: r.course_slug! }));
}

export interface AcknowledgeResult { learnerId: string; learnerEmail: string | null; learnerName: string; stepTitle: string; courseSlug: string; stepSlug: string; guideName: string }
export async function acknowledge(viewer: LmsViewer, responseId: string, input: { body?: string; audioUrl?: string }): Promise<WriteResult<{ notify: AcknowledgeResult }>> {
  if (!viewer.userId) return { ok: false, error: 'Sign in first.' };
  const body = input.body?.trim() || null;
  if (!body && !input.audioUrl) return { ok: false, error: 'Say something, even one line.' };
  const [r] = await db<Array<{ run_id: string; visibility: string; org_id: string; step_id: string; enrolment_id: string; user_id: string }>>`
    SELECT run_id, visibility, org_id, step_id, enrolment_id, user_id FROM lms_responses WHERE id = ${responseId}
  `;
  const run = r ? await getRun(r.run_id) : null;
  if (!r || !run || r.visibility === 'me' || !(await isRunStaff(viewer, run))) return { ok: false, error: 'That isn’t yours to answer.' };
  await db.begin(async (tx) => {
    await tx`INSERT INTO lms_acknowledgements (id, response_id, guide_id, body, audio_url) VALUES (${newId()}, ${responseId}, ${viewer.userId}, ${body}, ${input.audioUrl ?? null})`;
    await tx`INSERT INTO lms_events (org_id, actor_id, verb, object_type, object_id, enrolment_id) VALUES (${r.org_id}, ${viewer.userId}, 'acknowledged', 'response', ${responseId}, ${r.enrolment_id})`;
  });
  const [n] = await db<AcknowledgeResult[]>`
    SELECT u.id AS "learnerId", u.email AS "learnerEmail", COALESCE(u.display_name, 'there') AS "learnerName",
           COALESCE((SELECT sv.title FROM lms_step_versions sv JOIN lms_responses rr ON rr.step_version_id = sv.id WHERE rr.id = ${responseId}), s.slug) AS "stepTitle",
           c.slug AS "courseSlug", s.slug AS "stepSlug",
           COALESCE((SELECT g.display_name FROM users g WHERE g.id = ${viewer.userId}), 'Your guide') AS "guideName"
    FROM users u, lms_steps s JOIN lms_courses c ON c.id = s.course_id WHERE u.id = ${r.user_id} AND s.id = ${r.step_id}
  `;
  return { ok: true, notify: n };
}

/** Replies from a guide you haven't opened yet. For a quiet dot, not a badge count. */
export async function countUnseenAcknowledgements(userId: string): Promise<number> {
  const [{ n }] = await db<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM lms_acknowledgements a JOIN lms_responses r ON r.id = a.response_id WHERE r.user_id = ${userId} AND a.seen_at IS NULL
  `;
  return n;
}
export async function markAcknowledgementsSeen(userId: string): Promise<void> {
  await db`UPDATE lms_acknowledgements a SET seen_at = NOW() FROM lms_responses r WHERE r.id = a.response_id AND r.user_id = ${userId} AND a.seen_at IS NULL`;
}

/** Days on which you did something, for a plain practice calendar. No streaks. */
export async function listPracticeDays(userId: string, days = 84): Promise<string[]> {
  const rows = await db<Array<{ d: string }>>`
    SELECT DISTINCT to_char(occurred_at AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD') AS d
    FROM lms_events WHERE actor_id = ${userId} AND verb IN ('completed', 'responded') AND occurred_at > NOW() - make_interval(days => ${days})
  `;
  return rows.map((r) => r.d);
}

export async function listAwards(userId: string): Promise<Array<{ id: string; name: string; description: string | null; awardedAt: Date; courseSlug: string | null }>> {
  return db`
    SELECT w.id, a.name, a.description, w.awarded_at AS "awardedAt", c.slug AS "courseSlug"
    FROM lms_awards w JOIN lms_achievements a ON a.id = w.achievement_id LEFT JOIN lms_courses c ON c.id = a.course_id
    WHERE w.user_id = ${userId} AND w.revoked_at IS NULL ORDER BY w.awarded_at DESC
  `;
}
