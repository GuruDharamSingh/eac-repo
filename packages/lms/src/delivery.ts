// ============================================================================
// DELIVERY layer — runs, staff, entitlements, enrolments.
// ============================================================================
import { db } from '@elkdonis/db';
import type { Course, Enrolment, LmsViewer, Run, RunMode, WriteResult } from './types';
import { canEditCourse, getCourseById } from './content';
import { isOrgStaff, newId, slugify } from './util';

interface RunRow {
  id: string; course_id: string; org_id: string; slug: string; title: string; mode: RunMode;
  course_version_id: string; auto_fast_forward: boolean; is_default: boolean; status: Run['status'];
  starts_at: Date | null; ends_at: Date | null; capacity: number | null; enrol_policy: Run['enrolPolicy'];
  default_visibility: Run['defaultVisibility']; workshop_thread_id: string | null; discussion_feed: string | null;
}
const mapRun = (r: RunRow): Run => ({
  id: r.id, courseId: r.course_id, orgId: r.org_id, slug: r.slug, title: r.title, mode: r.mode,
  courseVersionId: r.course_version_id, autoFastForward: r.auto_fast_forward, isDefault: r.is_default,
  status: r.status, startsAt: r.starts_at, endsAt: r.ends_at, capacity: r.capacity, enrolPolicy: r.enrol_policy,
  defaultVisibility: r.default_visibility, workshopThreadId: r.workshop_thread_id, discussionFeed: r.discussion_feed,
});

interface EnrolRow {
  id: string; run_id: string; course_id: string; user_id: string; org_id: string; status: Enrolment['status'];
  anchor_at: Date; last_step_id: string | null; enrolled_at: Date; completed_at: Date | null;
}
const mapEnrol = (r: EnrolRow): Enrolment => ({
  id: r.id, runId: r.run_id, courseId: r.course_id, userId: r.user_id, orgId: r.org_id, status: r.status,
  anchorAt: r.anchor_at, lastStepId: r.last_step_id, enrolledAt: r.enrolled_at, completedAt: r.completed_at,
});

// ── runs ────────────────────────────────────────────────────────────────────
export async function getRun(runId: string): Promise<Run | null> {
  const [r] = await db<RunRow[]>`SELECT * FROM lms_runs WHERE id = ${runId}`;
  return r ? mapRun(r) : null;
}
export async function getRunBySlug(courseId: string, slug: string): Promise<Run | null> {
  const [r] = await db<RunRow[]>`SELECT * FROM lms_runs WHERE course_id = ${courseId} AND slug = ${slug}`;
  return r ? mapRun(r) : null;
}
export async function listRuns(courseId: string, opts: { includeClosed?: boolean } = {}): Promise<Array<Run & { enrolled: number }>> {
  const rows = await db<Array<RunRow & { enrolled: number }>>`
    SELECT r.*, (SELECT COUNT(*)::int FROM lms_enrolments e WHERE e.run_id = r.id AND e.status <> 'withdrawn') AS enrolled
    FROM lms_runs r WHERE r.course_id = ${courseId}
      ${opts.includeClosed ? db`` : db`AND r.status = 'open'`}
    ORDER BY r.is_default DESC, r.starts_at NULLS LAST, r.created_at
  `;
  return rows.map((r) => ({ ...mapRun(r), enrolled: r.enrolled }));
}

/** Every published course has an always-open self-paced run. Idempotent. */
export async function ensureDefaultRun(course: Course): Promise<Run | null> {
  if (!course.publishedVersionId) return null;
  const [have] = await db<RunRow[]>`SELECT * FROM lms_runs WHERE course_id = ${course.id} AND is_default`;
  if (have) return mapRun(have);
  const id = newId();
  await db`
    INSERT INTO lms_runs (id, course_id, org_id, slug, title, mode, course_version_id, is_default)
    VALUES (${id}, ${course.id}, ${course.orgId}, 'open', 'At your own pace', 'open', ${course.publishedVersionId}, TRUE)
    ON CONFLICT DO NOTHING
  `;
  const [r] = await db<RunRow[]>`SELECT * FROM lms_runs WHERE course_id = ${course.id} AND is_default`;
  return r ? mapRun(r) : null;
}

export interface CreateRunInput {
  title: string; slug?: string; mode: RunMode; startsAt?: Date | null; endsAt?: Date | null; capacity?: number | null;
  enrolPolicy?: Run['enrolPolicy']; defaultVisibility?: Run['defaultVisibility'];
  /** Bind the run to an existing workshop/meeting thread: its Talk room, calendar and RSVPs. */
  workshopThreadId?: string | null;
  discussionFeed?: string | null;
  guideIds?: string[];
}
export async function createRun(viewer: LmsViewer, courseId: string, input: CreateRunInput): Promise<WriteResult<{ run: Run }>> {
  const course = await getCourseById(courseId);
  if (!course) return { ok: false, error: 'No such course.' };
  if (!(await canEditCourse(viewer, course))) return { ok: false, error: 'You can’t open a run of this course.' };
  if (!course.publishedVersionId) return { ok: false, error: 'Publish the course first.' };
  const slug = slugify(input.slug || input.title);
  if (!slug) return { ok: false, error: 'Give the run a name.' };
  if (await getRunBySlug(courseId, slug)) return { ok: false, error: 'This course already has a run with that name.' };
  if (input.workshopThreadId) {
    const [t] = await db<Array<{ org_id: string }>>`SELECT org_id FROM threads WHERE id = ${input.workshopThreadId}`;
    if (!t) return { ok: false, error: 'No such gathering to bind to.' };
  }
  const id = newId();
  const circleish = input.mode === 'cohort' || input.mode === 'circle';
  await db.begin(async (tx) => {
    await tx`
      INSERT INTO lms_runs (id, course_id, org_id, slug, title, mode, course_version_id, starts_at, ends_at, capacity,
                            enrol_policy, default_visibility, workshop_thread_id, discussion_feed)
      VALUES (${id}, ${courseId}, ${course.orgId}, ${slug}, ${input.title.trim()}, ${input.mode}, ${course.publishedVersionId},
              ${input.startsAt ?? null}, ${input.endsAt ?? null}, ${input.capacity ?? null},
              ${input.enrolPolicy ?? 'open'}, ${input.defaultVisibility ?? (circleish ? 'circle' : 'me')},
              ${input.workshopThreadId ?? null}, ${input.discussionFeed ?? null})
    `;
    for (const g of input.guideIds ?? []) {
      // eslint-disable-next-line no-await-in-loop
      await tx`INSERT INTO lms_run_staff (run_id, user_id, role) VALUES (${id}, ${g}, 'guide') ON CONFLICT DO NOTHING`;
    }
  });
  return { ok: true, run: (await getRun(id))! };
}

/** Move a run to the course's current published version (a structural change, accepted). */
export async function adoptLatestVersion(viewer: LmsViewer, runId: string): Promise<WriteResult> {
  const run = await getRun(runId);
  if (!run) return { ok: false, error: 'No such run.' };
  if (!(await isRunStaff(viewer, run))) return { ok: false, error: 'Guides only.' };
  const course = await getCourseById(run.courseId);
  if (!course?.publishedVersionId) return { ok: false, error: 'Nothing published.' };
  await db`UPDATE lms_runs SET course_version_id = ${course.publishedVersionId}, updated_at = NOW() WHERE id = ${runId}`;
  return { ok: true };
}

// ── staff ───────────────────────────────────────────────────────────────────
export async function isRunStaff(viewer: LmsViewer, run: Pick<Run, 'id' | 'orgId'>): Promise<boolean> {
  if (!viewer.userId) return false;
  if (isOrgStaff(viewer, run.orgId)) return true;
  const [row] = await db`SELECT 1 FROM lms_run_staff WHERE run_id = ${run.id} AND user_id = ${viewer.userId}`;
  return Boolean(row);
}
export async function listRunGuides(runId: string): Promise<Array<{ id: string; name: string; avatarUrl: string | null; slug: string | null; email: string | null }>> {
  return db`
    SELECT u.id, COALESCE(u.display_name, 'A guide') AS name, u.avatar_url AS "avatarUrl", u.slug, u.email
    FROM lms_run_staff s JOIN users u ON u.id = s.user_id WHERE s.run_id = ${runId} AND s.role = 'guide' ORDER BY s.created_at
  `;
}
export async function addRunGuide(viewer: LmsViewer, runId: string, userId: string): Promise<WriteResult> {
  const run = await getRun(runId);
  if (!run) return { ok: false, error: 'No such run.' };
  if (!isOrgStaff(viewer, run.orgId)) return { ok: false, error: 'Only the organization’s owners and guides can name a course guide.' };
  await db`INSERT INTO lms_run_staff (run_id, user_id, role) VALUES (${runId}, ${userId}, 'guide') ON CONFLICT DO NOTHING`;
  return { ok: true };
}

// ── entitlement + enrolment ─────────────────────────────────────────────────
/**
 * May this person take this course at all? A public or unlisted course is
 * free to anyone signed in (payments will add an 'order' source here); a
 * private one needs a grant, an org role, or staff.
 */
export async function isEntitled(viewer: LmsViewer, course: Course): Promise<boolean> {
  if (!viewer.userId) return false;
  if (course.visibility !== 'private') return true;
  if (viewer.roles[course.orgId] || viewer.isGlobalAdmin) return true;
  const [e] = await db`SELECT 1 FROM lms_entitlements WHERE user_id = ${viewer.userId} AND course_id = ${course.id} AND revoked_at IS NULL`;
  return Boolean(e);
}

export async function getEnrolment(userId: string, runId: string): Promise<Enrolment | null> {
  const [r] = await db<EnrolRow[]>`SELECT * FROM lms_enrolments WHERE run_id = ${runId} AND user_id = ${userId}`;
  return r ? mapEnrol(r) : null;
}
/** Their live seat in a course — the most recently active one if they hold several. */
export async function getActiveEnrolment(userId: string, courseId: string): Promise<Enrolment | null> {
  const [r] = await db<EnrolRow[]>`
    SELECT * FROM lms_enrolments WHERE course_id = ${courseId} AND user_id = ${userId} AND status <> 'withdrawn'
    ORDER BY COALESCE(last_seen_at, enrolled_at) DESC LIMIT 1
  `;
  return r ? mapEnrol(r) : null;
}
export async function listMyEnrolments(userId: string): Promise<Array<Enrolment & { courseSlug: string; courseTitle: string; runTitle: string; runMode: RunMode }>> {
  const rows = await db<Array<EnrolRow & { course_slug: string; course_title: string; run_title: string; run_mode: RunMode }>>`
    SELECT e.*, c.slug AS course_slug, c.title AS course_title, r.title AS run_title, r.mode AS run_mode
    FROM lms_enrolments e JOIN lms_courses c ON c.id = e.course_id JOIN lms_runs r ON r.id = e.run_id
    WHERE e.user_id = ${userId} AND e.status <> 'withdrawn' AND c.archived_at IS NULL
    ORDER BY COALESCE(e.last_seen_at, e.enrolled_at) DESC
  `;
  return rows.map((r) => ({ ...mapEnrol(r), courseSlug: r.course_slug, courseTitle: r.course_title, runTitle: r.run_title, runMode: r.run_mode }));
}

export async function enrol(viewer: LmsViewer, runId: string): Promise<WriteResult<{ enrolment: Enrolment; isNew: boolean }>> {
  if (!viewer.userId) return { ok: false, error: 'Sign in to begin — it’s how your place is kept.' };
  const run = await getRun(runId);
  if (!run || run.status !== 'open') return { ok: false, error: 'This isn’t open for joining.' };
  const course = await getCourseById(run.courseId);
  if (!course) return { ok: false, error: 'No such course.' };

  const existing = await getEnrolment(viewer.userId, runId);
  if (existing && existing.status !== 'withdrawn') return { ok: true, enrolment: existing, isNew: false };

  const staff = await isRunStaff(viewer, run);
  if (!staff) {
    if (!(await isEntitled(viewer, course))) return { ok: false, error: 'This course is by invitation.' };
    if (run.enrolPolicy === 'invite') return { ok: false, error: 'The guide adds people to this group.' };
    if (run.capacity) {
      const [{ n }] = await db<Array<{ n: number }>>`SELECT COUNT(*)::int AS n FROM lms_enrolments WHERE run_id = ${runId} AND status <> 'withdrawn'`;
      if (n >= run.capacity) return { ok: false, error: 'This group is full.' };
    }
  }
  // A cohort counts its days from the day it starts; everyone else from today.
  const anchor = run.startsAt && run.startsAt > new Date() ? run.startsAt : run.mode === 'cohort' && run.startsAt ? run.startsAt : new Date();

  const id = existing?.id ?? newId();
  await db.begin(async (tx) => {
    if (course.visibility !== 'private') {
      await tx`
        INSERT INTO lms_entitlements (id, user_id, course_id, org_id, source) VALUES (${newId()}, ${viewer.userId}, ${course.id}, ${course.orgId}, 'free')
        ON CONFLICT (user_id, course_id, source, source_ref) DO NOTHING
      `;
    }
    await tx`
      INSERT INTO lms_enrolments (id, run_id, course_id, user_id, org_id, anchor_at)
      VALUES (${id}, ${runId}, ${course.id}, ${viewer.userId}, ${course.orgId}, ${anchor})
      ON CONFLICT (run_id, user_id) DO UPDATE SET status = 'active', anchor_at = EXCLUDED.anchor_at
    `;
    await tx`
      INSERT INTO lms_events (org_id, actor_id, verb, object_type, object_id, object_version_id, enrolment_id)
      VALUES (${course.orgId}, ${viewer.userId}, 'registered', 'run', ${runId}, ${run.courseVersionId}, ${id})
    `;
  });
  return { ok: true, enrolment: (await getEnrolment(viewer.userId, runId))!, isNew: true };
}

export async function withdraw(viewer: LmsViewer, enrolmentId: string): Promise<WriteResult> {
  if (!viewer.userId) return { ok: false, error: 'Sign in first.' };
  const [e] = await db<EnrolRow[]>`SELECT * FROM lms_enrolments WHERE id = ${enrolmentId} AND user_id = ${viewer.userId}`;
  if (!e) return { ok: false, error: 'No such place.' };
  await db.begin(async (tx) => {
    await tx`UPDATE lms_enrolments SET status = 'withdrawn' WHERE id = ${enrolmentId}`;
    await tx`INSERT INTO lms_events (org_id, actor_id, verb, object_type, object_id, enrolment_id) VALUES (${e.org_id}, ${viewer.userId}, 'withdrew', 'run', ${e.run_id}, ${enrolmentId})`;
  });
  return { ok: true };
}

export interface RosterRow { enrolmentId: string; userId: string; name: string; avatarUrl: string | null; status: Enrolment['status']; enrolledAt: Date; lastSeenAt: Date | null; done: number }
/** Who is in a run and roughly where. Staff only. */
export async function listRoster(viewer: LmsViewer, runId: string): Promise<RosterRow[] | null> {
  const run = await getRun(runId);
  if (!run || !(await isRunStaff(viewer, run))) return null;
  return db<RosterRow[]>`
    SELECT e.id AS "enrolmentId", u.id AS "userId", COALESCE(u.display_name, 'Someone') AS name, u.avatar_url AS "avatarUrl",
           e.status, e.enrolled_at AS "enrolledAt", e.last_seen_at AS "lastSeenAt",
           (SELECT COUNT(*)::int FROM lms_step_state s WHERE s.enrolment_id = e.id AND s.status IN ('completed','waived')) AS done
    FROM lms_enrolments e JOIN users u ON u.id = e.user_id
    WHERE e.run_id = ${runId} AND e.status <> 'withdrawn' ORDER BY e.enrolled_at
  `;
}
