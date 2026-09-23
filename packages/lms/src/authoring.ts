// ============================================================================
// Authoring — what the studio needs on top of content.ts/delivery.ts:
// which courses you may edit, small edits to the working outline, what a
// publish would change, run settings, and bringing a workshop's RSVPs in.
// ============================================================================
import { db } from '@elkdonis/db';
import type { Course, LmsViewer, Outline, OutlineModule, Run, RunMode, StepRefs, StepSettings, UnlockRule, WriteResult } from './types';
import { canEditCourse, getCourseById, setDraftOutline, upsertStepDraft } from './content';
import { getRun, isRunStaff } from './delivery';
import { DEFAULT_RULE } from './unlock';
import { hashContent, isOrgStaff, newId } from './util';

/** Courses this person may edit: their orgs' (as owner/guide/steward) and any they are named author of. */
export async function listEditableCourses(viewer: LmsViewer): Promise<Array<Course & { hasPublished: boolean }>> {
  if (!viewer.userId) return [];
  const staffOrgs = Object.entries(viewer.roles).filter(([, r]) => r === 'owner' || r === 'guide').map(([o]) => o);
  const rows = await db<Array<{ id: string }>>`
    SELECT c.id FROM lms_courses c
    WHERE c.archived_at IS NULL AND (
      ${viewer.isGlobalAdmin ? db`TRUE` : db`c.org_id = ANY(${staffOrgs})`}
      OR EXISTS (SELECT 1 FROM lms_course_staff s WHERE s.course_id = c.id AND s.user_id = ${viewer.userId})
    ) ORDER BY c.created_at
  `;
  const courses = await Promise.all(rows.map((r) => getCourseById(r.id)));
  return courses.filter((c): c is Course => c !== null).map((c) => ({ ...c, hasPublished: Boolean(c.publishedVersionId) }));
}
/** Orgs this person could start a course in. */
export async function listAuthorOrgs(viewer: LmsViewer): Promise<Array<{ id: string; name: string }>> {
  const ids = Object.entries(viewer.roles).filter(([, r]) => r === 'owner' || r === 'guide').map(([o]) => o);
  if (!ids.length) return [];
  return db`SELECT id, name FROM organizations WHERE id = ANY(${ids}) ORDER BY name`;
}

// ── outline edits ───────────────────────────────────────────────────────────
export type OutlineOp =
  | { op: 'add-module'; title: string }
  | { op: 'edit-module'; moduleId: string; title: string; summary?: string | null }
  | { op: 'remove-module'; moduleId: string }
  | { op: 'move-module'; moduleId: string; dir: -1 | 1 }
  | { op: 'add-step'; moduleId: string; title: string; type: string }
  | { op: 'move-step'; stepId: string; dir: -1 | 1 }
  | { op: 'send-step'; stepId: string; moduleId: string }
  | { op: 'remove-step'; stepId: string }
  | { op: 'set-rule'; stepId: string; required: boolean; unlock: UnlockRule };

const swap = <T,>(a: T[], i: number, j: number) => { if (i >= 0 && j >= 0 && i < a.length && j < a.length) [a[i], a[j]] = [a[j], a[i]]; };

/** One small change to the WORKING outline. Nothing reaches learners until publish. */
export async function editOutline(viewer: LmsViewer, courseId: string, op: OutlineOp): Promise<WriteResult<{ stepId?: string }>> {
  const course = await getCourseById(courseId);
  if (!course || !(await canEditCourse(viewer, course))) return { ok: false, error: 'You can’t edit this course.' };
  const [row] = await db<Array<{ draft_outline: Outline }>>`SELECT draft_outline FROM lms_courses WHERE id = ${courseId}`;
  const o: Outline = JSON.parse(JSON.stringify(row.draft_outline));
  const find = (stepId: string) => { for (const m of o.modules) { const i = m.steps.findIndex((s) => s.stepId === stepId); if (i >= 0) return { m, i }; } return null; };
  let stepId: string | undefined;

  switch (op.op) {
    case 'add-module':
      if (!op.title.trim()) return { ok: false, error: 'Give the module a title.' };
      o.modules.push({ id: newId().slice(0, 8), title: op.title.trim(), summary: null, steps: [] });
      break;
    case 'edit-module': {
      const m = o.modules.find((x) => x.id === op.moduleId);
      if (!m) return { ok: false, error: 'No such module.' };
      m.title = op.title.trim() || m.title; m.summary = op.summary?.trim() || null;
      break;
    }
    case 'remove-module': {
      const m = o.modules.find((x) => x.id === op.moduleId);
      if (m?.steps.length) return { ok: false, error: 'Move or remove its steps first.' };
      o.modules = o.modules.filter((x) => x.id !== op.moduleId);
      break;
    }
    case 'move-module': { const i = o.modules.findIndex((x) => x.id === op.moduleId); swap(o.modules, i, i + op.dir); break; }
    case 'add-step': {
      const m = o.modules.find((x) => x.id === op.moduleId);
      if (!m) return { ok: false, error: 'No such module.' };
      const r = await upsertStepDraft(viewer, courseId, { title: op.title, type: op.type || 'reading' });
      if (r.ok === false) return r;
      stepId = r.stepId;
      m.steps.push({ stepId: r.stepId, required: true, unlock: DEFAULT_RULE });
      break;
    }
    case 'move-step': {
      const at = find(op.stepId); if (!at) return { ok: false, error: 'No such step.' };
      const j = at.i + op.dir;
      if (j >= 0 && j < at.m.steps.length) swap(at.m.steps, at.i, j);
      else {
        // Off the end of a module: into the neighbouring one.
        const mi = o.modules.indexOf(at.m) + op.dir; const dest: OutlineModule | undefined = o.modules[mi];
        if (dest) { const [s] = at.m.steps.splice(at.i, 1); if (op.dir < 0) dest.steps.push(s); else dest.steps.unshift(s); }
      }
      break;
    }
    case 'send-step': {
      const at = find(op.stepId); const dest = o.modules.find((x) => x.id === op.moduleId);
      if (!at || !dest) return { ok: false, error: 'No such step or module.' };
      const [s] = at.m.steps.splice(at.i, 1); dest.steps.push(s);
      break;
    }
    case 'remove-step': {
      const at = find(op.stepId); if (!at) return { ok: false, error: 'No such step.' };
      at.m.steps.splice(at.i, 1);
      // Out of the working outline only. Published versions that include it are
      // untouched, and so is anyone's record of having done it.
      break;
    }
    case 'set-rule': {
      const at = find(op.stepId); if (!at) return { ok: false, error: 'No such step.' };
      if (op.unlock.kind === 'after_module' && !o.modules.some((m) => m.id === (op.unlock as { moduleId: string }).moduleId)) return { ok: false, error: 'Pick a module for it to follow.' };
      if (op.unlock.kind === 'date' && Number.isNaN(new Date(op.unlock.at).getTime())) return { ok: false, error: 'That isn’t a date.' };
      if (op.unlock.kind === 'offset_days' && !(op.unlock.days >= 0 && op.unlock.days <= 3650)) return { ok: false, error: 'Days must be a number from 0 up.' };
      at.m.steps[at.i] = { stepId: op.stepId, required: op.required, unlock: op.unlock };
      break;
    }
  }
  const r = await setDraftOutline(viewer, courseId, o);
  return r.ok === false ? r : { ok: true, stepId };
}

/** Steps that were once in the course and are in neither the working outline nor archived — restorable. */
export async function listLooseSteps(courseId: string): Promise<Array<{ stepId: string; title: string; type: string }>> {
  return db`
    SELECT s.id AS "stepId", d.title, s.type FROM lms_steps s JOIN lms_step_drafts d ON d.step_id = s.id, lms_courses c
    WHERE s.course_id = ${courseId} AND c.id = s.course_id AND s.archived_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.draft_outline->'modules') m, jsonb_array_elements(m->'steps') st WHERE st->>'stepId' = s.id)
  `;
}

/** What "Publish" would do right now. */
export async function draftDiff(courseId: string): Promise<{ neverPublished: boolean; changedStepIds: string[]; outlineChanged: boolean; detailsChanged: boolean; missingSummaries: string[]; empty: boolean }> {
  const [c] = await db<Array<{ draft_outline: Outline; published_version_id: string | null; title: string; summary: string | null; description_html: string | null }>>`
    SELECT draft_outline, published_version_id, title, summary, description_html FROM lms_courses WHERE id = ${courseId}
  `;
  const ids = c.draft_outline.modules.flatMap((m) => m.steps.map((s) => s.stepId));
  type DraftRow = { step_id: string; title: string; summary: string | null; body_html: string | null; settings: StepSettings; refs: StepRefs };
  const drafts: DraftRow[] = ids.length ? await db<Array<{ step_id: string; title: string; summary: string | null; body_html: string | null; settings: StepSettings; refs: StepRefs }>>`
    SELECT step_id, title, summary, body_html, settings, refs FROM lms_step_drafts WHERE step_id = ANY(${ids})` : [];
  const latest: Array<{ step_id: string; content_hash: string }> = ids.length ? await db<Array<{ step_id: string; content_hash: string }>>`
    SELECT DISTINCT ON (step_id) step_id, content_hash FROM lms_step_versions WHERE step_id = ANY(${ids}) ORDER BY step_id, version_no DESC` : [];
  const last = new Map<string, string>(latest.map((l) => [l.step_id, l.content_hash] as [string, string]));
  const changedStepIds = drafts.filter((d) => last.get(d.step_id) !== hashContent([d.title, d.summary, d.body_html, d.settings, d.refs])).map((d) => d.step_id);
  let outlineChanged = true, detailsChanged = true;
  if (c.published_version_id) {
    const [pv] = await db<Array<{ outline: Outline; title: string; summary: string | null; description_html: string | null }>>`SELECT outline, title, summary, description_html FROM lms_course_versions WHERE id = ${c.published_version_id}`;
    const shape = (o: Outline) => JSON.stringify(o.modules.map((m) => [m.id, m.title, m.summary ?? null, m.steps.map((s) => [s.stepId, s.required !== false, s.unlock ?? DEFAULT_RULE])]));
    outlineChanged = shape(pv.outline) !== shape(c.draft_outline);
    detailsChanged = pv.title !== c.title || pv.summary !== c.summary || pv.description_html !== c.description_html;
  }
  return {
    neverPublished: !c.published_version_id, changedStepIds, outlineChanged, detailsChanged, empty: ids.length === 0,
    missingSummaries: drafts.filter((d) => !d.summary?.trim()).map((d) => d.title),
  };
}

// ── runs ────────────────────────────────────────────────────────────────────
export interface UpdateRunInput {
  title?: string; mode?: RunMode; status?: Run['status']; startsAt?: Date | null; endsAt?: Date | null; capacity?: number | null;
  enrolPolicy?: Run['enrolPolicy']; defaultVisibility?: Run['defaultVisibility']; workshopThreadId?: string | null; discussionFeed?: string | null;
  autoFastForward?: boolean;
}
export async function updateRun(viewer: LmsViewer, runId: string, p: UpdateRunInput): Promise<WriteResult> {
  const run = await getRun(runId);
  if (!run || !(await isRunStaff(viewer, run))) return { ok: false, error: 'Guides only.' };
  if (run.isDefault && p.status && p.status !== 'open') return { ok: false, error: 'The at-your-own-pace run stays open; unlist the course instead.' };
  if (p.workshopThreadId) {
    const [t] = await db`SELECT 1 FROM threads WHERE id = ${p.workshopThreadId}`;
    if (!t) return { ok: false, error: 'No gathering with that id.' };
  }
  if (p.discussionFeed) {
    const [f] = await db`SELECT 1 FROM org_feeds WHERE org_id = ${run.orgId} AND slug = ${p.discussionFeed}`;
    if (!f) return { ok: false, error: 'That forum category doesn’t exist on this organization.' };
  }
  const v = <K extends keyof UpdateRunInput>(k: K, cur: unknown) => (p[k] === undefined ? cur : p[k]) as never;
  await db`
    UPDATE lms_runs SET
      title = ${v('title', run.title)}, mode = ${v('mode', run.mode)}, status = ${v('status', run.status)},
      starts_at = ${v('startsAt', run.startsAt)}, ends_at = ${v('endsAt', run.endsAt)}, capacity = ${v('capacity', run.capacity)},
      enrol_policy = ${v('enrolPolicy', run.enrolPolicy)}, default_visibility = ${v('defaultVisibility', run.defaultVisibility)},
      workshop_thread_id = ${v('workshopThreadId', run.workshopThreadId)}, discussion_feed = ${v('discussionFeed', run.discussionFeed)},
      auto_fast_forward = ${v('autoFastForward', run.autoFastForward)}, updated_at = NOW()
    WHERE id = ${runId}
  `;
  return { ok: true };
}

export async function addRunGuideByEmail(viewer: LmsViewer, runId: string, email: string): Promise<WriteResult> {
  const run = await getRun(runId);
  if (!run || !isOrgStaff(viewer, run.orgId)) return { ok: false, error: 'Only the organization’s owners and guides can name a course guide.' };
  const [u] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE lower(email) = ${email.trim().toLowerCase()}`;
  if (!u) return { ok: false, error: 'No one on the network has that email yet.' };
  await db`INSERT INTO lms_run_staff (run_id, user_id, role) VALUES (${runId}, ${u.id}, 'guide') ON CONFLICT DO NOTHING`;
  return { ok: true };
}

/**
 * Another approach to workshops: a run bound to a workshop/meeting thread
 * takes in everyone who RSVP'd "yes" to it (or paid to join it). They get an
 * 'rsvp' entitlement and a seat, anchored like any other enrolment. Idempotent;
 * never removes anyone.
 */
export async function syncWorkshopEnrolments(viewer: LmsViewer, runId: string): Promise<WriteResult<{ added: number }>> {
  const run = await getRun(runId);
  if (!run || !(await isRunStaff(viewer, run))) return { ok: false, error: 'Guides only.' };
  if (!run.workshopThreadId) return { ok: false, error: 'This run isn’t bound to a gathering.' };
  const people = await db<Array<{ user_id: string }>>`
    SELECT user_id FROM thread_rsvps WHERE thread_id = ${run.workshopThreadId} AND status = 'yes'
    UNION
    SELECT user_id FROM workshop_join_requests WHERE workshop_id = ${run.workshopThreadId} AND status = 'paid' AND user_id IS NOT NULL
  `;
  const anchor = run.startsAt ?? new Date();
  let added = 0;
  await db.begin(async (tx) => {
    for (const p of people) {
      // eslint-disable-next-line no-await-in-loop
      await tx`
        INSERT INTO lms_entitlements (id, user_id, course_id, org_id, source, source_ref, granted_by)
        VALUES (${newId()}, ${p.user_id}, ${run.courseId}, ${run.orgId}, 'rsvp', ${run.workshopThreadId}, ${viewer.userId})
        ON CONFLICT (user_id, course_id, source, source_ref) DO NOTHING
      `;
      const id = newId();
      // eslint-disable-next-line no-await-in-loop
      const ins = await tx`
        INSERT INTO lms_enrolments (id, run_id, course_id, user_id, org_id, anchor_at)
        VALUES (${id}, ${runId}, ${run.courseId}, ${p.user_id}, ${run.orgId}, ${anchor})
        ON CONFLICT (run_id, user_id) DO NOTHING RETURNING id
      `;
      if (ins.length) {
        added++;
        // eslint-disable-next-line no-await-in-loop
        await tx`INSERT INTO lms_events (org_id, actor_id, actor_type, verb, object_type, object_id, object_version_id, enrolment_id, result)
                 VALUES (${run.orgId}, ${p.user_id}, 'system', 'registered', 'run', ${runId}, ${run.courseVersionId}, ${id}, ${tx.json({ via: 'rsvp', threadId: run.workshopThreadId })})`;
      }
    }
  });
  return { ok: true, added };
}
