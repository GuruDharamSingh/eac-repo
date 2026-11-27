// ============================================================================
// MAKING A WORKSPACE (slice 2; migration 287 for the kind marker).
//
// Who: the owners and guides of an organisation (decision D3). A network admin with no such role does not create. One call makes the
// course (private or unlisted, with a starter session and step per session so publishing is possible), marks it a workspace,
// publishes it, opens the cohort run with the creator as its guide, and (for an ongoing workspace) makes the one session ongoing.
// If any step fails the half-made course is archived again, so nothing half-built is left in the lists.
// Everything goes through the engine's own functions (createCourse, upsertStepDraft, setDraftOutline, publishCourse, createRun).
// Until migration 287 exists the marker is skipped and everything else still works.
// ============================================================================
import { db } from '@elkdonis/db';
import { sanitizeRichText } from '@elkdonis/utils';
import type { LmsViewer, Outline, WriteResult } from './types';
import { createCourse, getCourseBySlug, publishCourse, setDraftOutline, updateCourse, upsertStepDraft } from './content';
import { createRun } from './delivery';
import { saveOngoingSession } from './ongoing';
import { ongoingAvailable } from './workspaces';
import { setWorkspacePreset } from './workspace-experiment';
import { newId } from './util';

export type CourseKind = 'course' | 'workspace';

let kindCache: { at: number; ok: boolean } | null = null;
/** True once migration 287 exists (lms_courses.kind). Cached for 20 s. */
export async function courseKindAvailable(): Promise<boolean> {
  if (kindCache && Date.now() - kindCache.at < 20_000) return kindCache.ok;
  let ok = false;
  try {
    const [r] = await db<Array<{ ok: boolean }>>`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lms_courses' AND column_name = 'kind') AS ok`;
    ok = Boolean(r?.ok);
  } catch { ok = false; }
  kindCache = { at: Date.now(), ok };
  return ok;
}

/** The kind of one course by slug; 'course' when the marker does not exist yet. */
export async function getCourseKind(slug: string): Promise<CourseKind> {
  if (!(await courseKindAvailable())) return 'course';
  const [r] = await db<Array<{ kind: CourseKind }>>`SELECT kind FROM lms_courses WHERE slug = ${slug} AND archived_at IS NULL`;
  return r?.kind === 'workspace' ? 'workspace' : 'course';
}

/** The kinds of several courses by slug (for Studio's list). Empty until 287 exists. */
export async function getCourseKinds(slugs: string[]): Promise<Record<string, CourseKind>> {
  if (!slugs.length || !(await courseKindAvailable())) return {};
  const rows = await db<Array<{ slug: string; kind: CourseKind }>>`SELECT slug, kind FROM lms_courses WHERE slug IN ${db(slugs)}`;
  return Object.fromEntries(rows.map((r) => [r.slug, r.kind]));
}

/** Mark a course a workspace (or back). Staff of the course's organisation only. */
export async function setCourseKind(viewer: LmsViewer, courseSlug: string, kind: CourseKind): Promise<WriteResult> {
  if (!(await courseKindAvailable())) return { ok: false, error: 'Course kinds are not switched on yet.' };
  const course = await getCourseBySlug(courseSlug);
  if (!course) return { ok: false, error: 'No such course.' };
  const role = viewer.roles[course.orgId];
  if (!viewer.userId || (role !== 'owner' && role !== 'guide')) return { ok: false, error: 'Only the organisation’s owners and guides can do that.' };
  await db`UPDATE lms_courses SET kind = ${kind} WHERE id = ${course.id}`;
  return { ok: true };
}

/** The organisations this person may create a workspace in: those where they are an owner or a guide. A network admin with no such role gets none. */
export async function listWorkspaceCreatorOrgs(viewer: LmsViewer): Promise<Array<{ id: string; name: string }>> {
  if (!viewer.userId) return [];
  const ids = Object.entries(viewer.roles).filter(([, r]) => r === 'owner' || r === 'guide').map(([o]) => o);
  if (!ids.length) return [];
  return db<Array<{ id: string; name: string }>>`SELECT id, name FROM organizations WHERE id IN ${db(ids)} ORDER BY name`;
}

export interface NewWorkspaceInput {
  orgId: string;
  title: string;
  line?: string;
  /** "Thu 14 Jan, 7:00 pm": a date like 14 Jan lets the sessions be dated weekly. */
  when?: string;
  where?: 'In person' | 'Online' | 'Both';
  sessions?: number;
  ongoing?: boolean;
  visibility?: 'private' | 'unlisted';
  join?: 'open' | 'invite';
  /** An experiment: an ongoing test log, a closed circle, and a consent text people agree to before they can take part. */
  experiment?: boolean;
  consentText?: string;
}

const PALETTE = ['#2f4d68', '#6b3f2e', '#6a5524', '#5a3a5e', '#3d5a46', '#6b3a3a', '#3a4f6b', '#4d4a2c'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function weekly(i: number, when: string): string {
  const m = /(\d{1,2})\s+([A-Za-z]{3})/.exec(when);
  const mi = m ? MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase()) : -1;
  if (!m || mi < 0) return i === 0 ? when : '';
  const d = new Date(Date.UTC(2026, mi, Number(m[1]) + i * 7));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type CreateWorkspaceResult = { ok: true; slug: string; courseId: string; runId: string } | { ok: false; error: string };

/** Make a workspace in one go. See the header for who may, and what it makes. */
export async function createWorkspace(viewer: LmsViewer, input: NewWorkspaceInput): Promise<CreateWorkspaceResult> {
  const role = viewer.roles[input.orgId];
  if (!viewer.userId || (role !== 'owner' && role !== 'guide')) return { ok: false, error: 'Only the organisation’s owners and guides can make a workspace.' };
  const title = (input.title ?? '').trim().slice(0, 160);
  if (!title) return { ok: false, error: 'What is it called?' };
  const experiment = Boolean(input.experiment);
  const ongoing = Boolean(input.ongoing) || experiment;
  const sessions = ongoing ? 1 : Math.max(1, Math.min(24, Math.round(Number(input.sessions) || 1)));
  const actor: LmsViewer = { userId: viewer.userId, roles: { ...viewer.roles, [input.orgId]: role } };
  let courseId: string | null = null;
  try {
    const where = input.where && ['In person', 'Online', 'Both'].includes(input.where) ? input.where : null;
    const about = `<p>${esc((input.line ?? '').trim() || title)}</p>${input.when?.trim() ? `<p>When: ${esc(input.when.trim())}</p>` : ''}${where ? `<p>Where: ${where}</p>` : ''}`;
    const made = await createCourse(actor, { orgId: input.orgId, title, summary: (input.line ?? '').trim().slice(0, 200) || undefined, descriptionHtml: sanitizeRichText(about), visibility: input.visibility === 'unlisted' ? 'unlisted' : 'private' });
    if (made.ok === false) return { ok: false, error: made.error };
    courseId = made.course.id;
    let slug = made.course.slug;
    if (slug === 'new' || slug === 'join') {
      const r = await updateCourse(actor, courseId, { slug: `${slug}-workspace` });
      if (r.ok === false) throw new Error(r.error);
      slug = `${slug}-workspace`;
    }
    if (await courseKindAvailable()) await db`UPDATE lms_courses SET kind = 'workspace' WHERE id = ${courseId}`;

    const outline: Outline = { modules: [] };
    let ongoingStep = '';
    for (let i = 0; i < sessions; i++) {
      const step = ongoing
        ? await upsertStepDraft(actor, courseId, { type: 'reflection', title: experiment ? 'Test log entry' : 'Daily entry', summary: experiment ? 'What you did, and what you observed.' : 'What did you do today, and what did you notice?', settings: { prompt: experiment ? 'What did you do, and what did you observe?' : 'What did you do today, and what did you notice?' } })
        : await upsertStepDraft(actor, courseId, { type: 'reading', title: 'Welcome', summary: 'The first thing to read in this session.', bodyHtml: '<p>Welcome. Replace this with what you want people to read first.</p>' });
      if (step.ok === false) throw new Error(step.error);
      if (ongoing) ongoingStep = step.stepId;
      const date = ongoing ? '' : weekly(i, (input.when ?? '').trim());
      outline.modules.push({
        id: newId().slice(0, 8), title: experiment ? 'Test log' : ongoing ? 'Daily practice' : `Session ${i + 1}`, summary: null,
        look: { colour: PALETTE[i % PALETTE.length], ...(date ? { date } : {}) },
        steps: [{ stepId: step.stepId, required: !ongoing, unlock: { kind: 'open' } }],
      });
    }
    const o = await setDraftOutline(actor, courseId, outline);
    if (o.ok === false) throw new Error(o.error);
    const pub = await publishCourse(actor, courseId, 'Made as a workspace');
    if (pub.ok === false) throw new Error(pub.error);
    const run = await createRun(actor, courseId, { title: 'Group', mode: 'cohort', enrolPolicy: experiment || input.join !== 'open' ? 'invite' : 'open', defaultVisibility: experiment ? 'circle' : 'guide', guideIds: [viewer.userId] });
    if (run.ok === false) throw new Error(run.error);
    if (ongoing && (await ongoingAvailable())) {
      const s = await saveOngoingSession(actor, run.run.id, { moduleId: outline.modules[0].id, stepId: ongoingStep, everyDays: 1, start: new Date().toISOString().slice(0, 10), end: null, closes: true, readFirst: false, show: 5 });
      if (s.ok === false) throw new Error(s.error);
    }
    if (experiment) {
      const p = await setWorkspacePreset(viewer.userId, run.run.id, 'experiment', input.consentText);
      if (p.ok === false) throw new Error(p.error);
    }
    return { ok: true, slug, courseId, runId: run.run.id };
  } catch (err) {
    // Nothing half-made stays in the lists.
    if (courseId) await db`UPDATE lms_courses SET archived_at = NOW() WHERE id = ${courseId}`.catch(() => undefined);
    return { ok: false, error: err instanceof Error ? err.message : 'That could not be made. Nothing was kept.' };
  }
}

/** Put a workspace away (the course is archived: gone from every list, nothing deleted). Its guides and the organisation's owners and guides only. */
export async function archiveWorkspace(viewer: LmsViewer, courseSlug: string): Promise<WriteResult> {
  const course = await getCourseBySlug(courseSlug);
  if (!course) return { ok: false, error: 'No such workspace.' };
  const role = viewer.roles[course.orgId];
  const orgGuide = role === 'owner' || role === 'guide';
  if (!viewer.userId || !orgGuide) return { ok: false, error: 'Only the organisation’s owners and guides can do that.' };
  await db`UPDATE lms_courses SET archived_at = NOW(), updated_at = NOW() WHERE id = ${course.id}`;
  await db`INSERT INTO lms_events (org_id, actor_id, verb, object_type, object_id) VALUES (${course.orgId}, ${viewer.userId}, 'archived', 'course', ${course.id})`.catch(() => undefined);
  return { ok: true };
}
