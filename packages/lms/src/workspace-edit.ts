// ============================================================================
// WORKSPACE EDITING AND SETTINGS (slice 6 + 4b; migration 286 for settings and invites).
//
// The guide's side of a workspace, built to the prototype's Editing mode and Settings menu. Every write goes through the
// engine's own functions (updateCourse, upsertStepDraft, setDraftOutline, publishCourse, adoptLatestVersion, updateRun,
// enrol, the 285 ongoing functions): never raw SQL on LMS content. Who may save: the guides named on the run, and the
// organisation's owners and guides. Network admins and anyone else may VIEW (where the reads allow) but every write is refused.
// What guides edit is the DRAFT; participants see only what is published. Publishing a wording-only change moves the group
// on at once; a structural change (steps added, removed or reordered) waits for the guide to move the group, with a count of
// how many people are partway through.
// Settings and invites fail soft: until migration 286 exists the defaults apply and the writes say they are not switched on.
// ============================================================================
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@elkdonis/db';
import { sanitizeRichText } from '@elkdonis/utils';
import type { Course, LmsViewer, Outline, OutlineModule, OutlineStepRef, PublishedCourse, PublishedModule, PublishedStep, StepSettings, UnlockRule, WriteResult } from './types';
import type { MaterialItem } from './ongoing';
import { getWorkspaceView, type WorkspaceView } from './workspaces';
import { getDraft, publishCourse, setDraftOutline, upsertStepDraft, updateCourse, getCourseById } from './content';
import { adoptLatestVersion, enrol, getRun } from './delivery';
import { updateRun } from './authoring';
import { deleteOngoingSession, listOngoingSessions, saveIntervalPlan, saveOngoingSession } from './ongoing';
import { hashContent, newId } from './util';

// ── settings storage (286) ──────────────────────────────────────────────────
export interface WorkspaceSettings {
  commentsBy: 'guide' | 'everyone';
  callUrl: string | null;
  emails: { to: 'everyone' | 'guide' | 'nobody'; when: 'each' | 'digest'; remind: boolean };
  digestOn: boolean;
}
export const DEFAULT_SETTINGS: WorkspaceSettings = { commentsBy: 'everyone', callUrl: null, emails: { to: 'guide', when: 'each', remind: false }, digestOn: false };

let settingsCache: { at: number; ok: boolean } | null = null;
/** True once migration 286 exists. Cached for 20 s. */
export async function workspaceSettingsAvailable(): Promise<boolean> {
  if (settingsCache && Date.now() - settingsCache.at < 20_000) return settingsCache.ok;
  let ok = false;
  try {
    const [r] = await db<Array<{ ok: boolean }>>`SELECT to_regclass('public.workspace_settings') IS NOT NULL AND to_regclass('public.workspace_invites') IS NOT NULL AS ok`;
    ok = Boolean(r?.ok);
  } catch { ok = false; }
  settingsCache = { at: Date.now(), ok };
  return ok;
}

/** A workspace's settings (defaults when none are stored or 286 is absent). */
export async function getWorkspaceSettings(runId: string): Promise<WorkspaceSettings> {
  if (!(await workspaceSettingsAvailable())) return DEFAULT_SETTINGS;
  const [r] = await db<Array<{ comments_by: 'guide' | 'everyone'; call_url: string | null; email_to: 'everyone' | 'guide' | 'nobody'; email_when: 'each' | 'digest'; email_remind: boolean; digest_on: boolean }>>`
    SELECT comments_by, call_url, email_to, email_when, email_remind, digest_on FROM workspace_settings WHERE host_type = 'lms_run' AND host_id = ${runId}
  `;
  if (!r) return DEFAULT_SETTINGS;
  return { commentsBy: r.comments_by, callUrl: r.call_url, emails: { to: r.email_to, when: r.email_when, remind: r.email_remind }, digestOn: r.digest_on };
}

async function saveSettings(userId: string, runId: string, patch: Partial<WorkspaceSettings>): Promise<WriteResult> {
  if (!(await workspaceSettingsAvailable())) return { ok: false, error: 'Settings are not switched on yet.' };
  const cur = await getWorkspaceSettings(runId);
  const next: WorkspaceSettings = { ...cur, ...patch, emails: { ...cur.emails, ...(patch.emails ?? {}) } };
  let url = next.callUrl?.trim() || null;
  if (url) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('scheme');
      url = u.toString().slice(0, 500);
    } catch { return { ok: false, error: 'That does not look like a web link (start it with https://).' }; }
  }
  await db`
    INSERT INTO workspace_settings (host_type, host_id, comments_by, call_url, email_to, email_when, email_remind, digest_on, updated_by)
    VALUES ('lms_run', ${runId}, ${next.commentsBy}, ${url}, ${next.emails.to}, ${next.emails.when}, ${next.emails.remind}, ${next.digestOn}, ${userId})
    ON CONFLICT (host_type, host_id) DO UPDATE SET comments_by = EXCLUDED.comments_by, call_url = EXCLUDED.call_url, email_to = EXCLUDED.email_to,
      email_when = EXCLUDED.email_when, email_remind = EXCLUDED.email_remind, digest_on = EXCLUDED.digest_on, updated_by = EXCLUDED.updated_by, updated_at = NOW()
  `;
  return { ok: true };
}

// ── who may save ────────────────────────────────────────────────────────────
/**
 * The viewer the engine is called with when a workspace guide saves, or null when they may not. Only the guides named on the run and
 * the organisation's owners and guides qualify; a network admin with no such role does not (the role, not the admin flag, decides).
 * A named run guide who is not an org guide is lifted to the course organisation's guide role for the engine calls, after this gate.
 */
export function workspaceActor(viewer: LmsViewer, view: WorkspaceView): LmsViewer | null {
  if (!viewer.userId || !view.run) return null;
  const role = viewer.roles[view.course.orgId];
  const orgGuide = role === 'owner' || role === 'guide';
  if (!orgGuide && !view.runGuide) return null;
  return { userId: viewer.userId, roles: { ...viewer.roles, [view.course.orgId]: orgGuide ? role : 'guide' } };
}

// ── the draft, as a workspace view ──────────────────────────────────────────
export interface WorkspaceDraftView extends WorkspaceView {
  settings: WorkspaceSettings;
  /** Edits not yet published. */
  unpublished: boolean;
  /** The course is currently a draft, never published. */
  hasPublished: boolean;
  /** False for a read-only look (a network admin with no role in the organisation). */
  canSave: boolean;
}

/** The workspace as its guides edit it: the DRAFT outline and step text, in the same shape the screens already read. Null when the viewer may not save. */
export async function getWorkspaceDraftView(viewer: LmsViewer, courseSlug: string, opts: { viewOnly?: boolean } = {}): Promise<WorkspaceDraftView | null> {
  const view = await getWorkspaceView(viewer, courseSlug);
  if (!view?.run) return null;
  let actor = workspaceActor(viewer, view);
  let canSave = true;
  // A network admin with no role in the organisation may LOOK at the settings (read only); every write is still refused.
  if (!actor && opts.viewOnly && viewer.isGlobalAdmin && viewer.userId) { actor = { userId: viewer.userId, roles: { ...viewer.roles, [view.course.orgId]: 'guide' } }; canSave = false; }
  if (!actor) return null;
  const d = await getDraft(actor, view.course.id);
  if (!d) return null;
  const byId = new Map(d.steps.map((s) => [s.stepId, s]));
  const steps: PublishedStep[] = [];
  const modules: PublishedModule[] = d.outline.modules.map((m) => {
    const ms: PublishedStep[] = [];
    for (const ref of m.steps) {
      const s = byId.get(ref.stepId);
      if (!s) continue;
      const step: PublishedStep = {
        stepId: s.stepId, stepVersionId: '', slug: s.slug, type: s.type, title: s.title, summary: s.summary, bodyHtml: s.bodyHtml, settings: s.settings ?? {}, refs: s.refs ?? {},
        moduleId: m.id, moduleTitle: m.title, index: steps.length, required: ref.required !== false, unlock: ref.unlock ?? ({ kind: 'sequential' } as UnlockRule),
      };
      steps.push(step); ms.push(step);
    }
    return { id: m.id, title: m.title, summary: m.summary ?? null, steps: ms, ...(m.look ? { look: m.look } : {}) };
  });
  const c = d.course;
  const published: PublishedCourse = { course: c, versionId: 'draft', versionNo: 0, publishedAt: new Date(), modules, steps };
  // Unpublished edits = the draft differs from what is published: the outline's shape and look, any step's content, the course's own words.
  const unpublished = await draftDiffers(c, d.outline, d.steps);
  return { ...view, course: c, published, settings: await getWorkspaceSettings(view.run.id), unpublished, hasPublished: Boolean(c.publishedVersionId), canSave };
}

// ── edits ───────────────────────────────────────────────────────────────────
export type StepKindName = 'reading' | 'practice' | 'reflection' | 'gathering' | 'conversation' | 'resource';
const KIND_TYPE: Record<StepKindName, string> = { reading: 'reading', practice: 'practice', reflection: 'reflection', gathering: 'session', conversation: 'thread', resource: 'resource' };
const KIND_LABEL: Record<StepKindName, string> = { reading: 'reading', practice: 'practice', reflection: 'reflection', gathering: 'gathering', conversation: 'conversation', resource: 'resource' };
const PALETTE = ['#2f4d68', '#6b3f2e', '#6a5524', '#5a3a5e', '#3d5a46', '#6b3a3a', '#3a4f6b', '#4d4a2c'];

export interface ModulePatch { title?: string; date?: string; length?: string; colour?: string; coverLabel?: string; coverUrl?: string; description?: string; materials?: Array<{ id: string; name: string; url?: string; access: 'open' | 'participants' }> }
export interface StepPatch { title?: string; prompt?: string; body?: string; required?: boolean; due?: string | null; timeLimit?: number | null; when?: string; where?: string; href?: string; fileName?: string }
export interface CoursePatch {
  title?: string; line?: string; journals?: 'private' | 'shared'; journalComments?: 'guide' | 'everyone'; callLink?: string | null;
  emails?: Partial<WorkspaceSettings['emails']>; join?: 'open' | 'invite'; status?: 'draft' | 'published'; endDate?: string | null; pacing?: 'open' | 'in-order';
}
export interface OngoingPatch { every?: 'day' | 'week'; everyDays?: number; start?: string; end?: string | null; closes?: boolean; readFirst?: boolean; show?: 5 | 7 }
export type EditOp =
  | { t: 'course'; patch: CoursePatch }
  | { t: 'module'; id: string; patch: ModulePatch }
  | { t: 'add-module' } | { t: 'remove-module'; id: string } | { t: 'move-module'; id: string; dir: -1 | 1 }
  | { t: 'add-step'; moduleId: string; kind: StepKindName }
  | { t: 'step'; id: string; patch: StepPatch }
  | { t: 'remove-step'; moduleId: string; id: string } | { t: 'move-step'; moduleId: string; id: string; dir: -1 | 1 }
  | { t: 'ongoing'; moduleId: string; on: boolean; patch?: OngoingPatch }
  | { t: 'plan'; moduleId: string; key: string; note?: string | null; items?: MaterialItem[] }
  | { t: 'publish'; adopt?: boolean }
  | { t: 'adopt' };

export interface PublishOutcome { changeKind: 'fix' | 'structural'; versionNo: number; /** People who have started a step: a structural change waits for the guide to move them. */ partway: number; adopted: boolean }
export type EditResult = { ok: true; view: WorkspaceDraftView; publish?: PublishOutcome } | { ok: false; error: string };

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Plain text from the editing box to the step's HTML body: blank lines make paragraphs. Markup the guide typed is kept and sanitised. */
function bodyToHtml(text: string): string {
  const t = text.replace(/\r\n/g, '\n').trim();
  if (!t) return '';
  if (/<\/?(p|h[1-6]|ul|ol|li|blockquote|div|br|em|strong|a)\b/i.test(t)) return sanitizeRichText(t);
  return t.split(/\n{2,}/).map((b) => `<p>${b.split('\n').map(esc).join('<br>')}</p>`).join('\n');
}
const htmlToText = (h: string | null) => (h ?? '').replace(/<\/p>\s*<p>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
export { htmlToText };

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);

/** Apply one edit to the draft (or publish it) as a guide of the workspace. Returns the fresh draft view. */
export async function applyWorkspaceEdit(viewer: LmsViewer, courseSlug: string, op: EditOp): Promise<EditResult> {
  const view0 = await getWorkspaceView(viewer, courseSlug);
  if (!view0?.run) return { ok: false, error: 'Not available.' };
  const actor = workspaceActor(viewer, view0);
  if (!actor) return { ok: false, error: 'Only the guides of this workspace can change it.' };
  const run = view0.run;
  const courseId = view0.course.id;
  const fail = (error: string): EditResult => ({ ok: false, error });
  const finish = async (publish?: PublishOutcome): Promise<EditResult> => {
    const v = await getWorkspaceDraftView(viewer, courseSlug);
    return v ? { ok: true, view: v, publish } : fail('Saved, but the page could not be refreshed.');
  };

  const draft = await getDraft(actor, courseId);
  if (!draft) return fail('No such workspace.');
  const outline: Outline = { modules: draft.outline.modules.map((m) => ({ ...m, steps: m.steps.map((s) => ({ ...s })) })) };
  const saveOutline = async (): Promise<WriteResult> => setDraftOutline(actor, courseId, outline);
  const mod = (id: string) => outline.modules.find((m) => m.id === id);
  const stepOf = (id: string) => draft.steps.find((s) => s.stepId === id);

  switch (op.t) {
    case 'course': {
      const p = op.patch;
      if (p.title !== undefined || p.line !== undefined) {
        const r = await updateCourse(actor, courseId, { ...(p.title !== undefined ? { title: str(p.title, 160) || draft.course.title } : {}), ...(p.line !== undefined ? { summary: str(p.line, 300) ?? '' } : {}) });
        if (r.ok === false) return fail(r.error);
      }
      const runPatch: Parameters<typeof updateRun>[2] = {};
      if (p.journals) runPatch.defaultVisibility = p.journals === 'shared' ? 'circle' : 'guide';
      if (p.join) runPatch.enrolPolicy = p.join;
      if (p.status) runPatch.status = p.status === 'published' ? 'open' : 'draft';
      if (p.endDate !== undefined) runPatch.endsAt = p.endDate ? new Date(`${p.endDate}T23:59:59`) : null;
      if (Object.keys(runPatch).length) { const r = await updateRun(actor, run.id, runPatch); if (r.ok === false) return fail(r.error); }
      const sp: Partial<WorkspaceSettings> = {};
      if (p.journalComments) sp.commentsBy = p.journalComments;
      if (p.callLink !== undefined) sp.callUrl = p.callLink;
      if (p.emails) sp.emails = p.emails as WorkspaceSettings['emails'];
      if (Object.keys(sp).length) { const r = await saveSettings(actor.userId!, run.id, sp); if (r.ok === false) return fail(r.error); }
      if (p.pacing) {
        const rule: UnlockRule = p.pacing === 'open' ? { kind: 'open' } : { kind: 'sequential' };
        for (const m of outline.modules) for (const s of m.steps) s.unlock = rule;
        const r = await saveOutline(); if (r.ok === false) return fail(r.error);
      }
      return finish();
    }
    case 'module': {
      const m = mod(op.id);
      if (!m) return fail('No such session.');
      const p = op.patch;
      if (p.title !== undefined) m.title = str(p.title, 160) || m.title;
      const look = { ...(m.look ?? {}) };
      for (const k of ['date', 'length', 'coverLabel', 'coverUrl', 'description', 'colour'] as const) if (p[k] !== undefined) (look as Record<string, unknown>)[k] = p[k] === '' ? undefined : p[k];
      if (p.materials !== undefined) look.materials = p.materials;
      m.look = look;
      const r = await saveOutline(); if (r.ok === false) return fail(r.error);
      return finish();
    }
    case 'add-module': {
      outline.modules.push({ id: newId().slice(0, 8), title: `Session ${outline.modules.length + 1}`, summary: null, steps: [], look: { colour: PALETTE[outline.modules.length % PALETTE.length] } });
      const r = await saveOutline(); if (r.ok === false) return fail(r.error);
      return finish();
    }
    case 'remove-module': {
      outline.modules = outline.modules.filter((m) => m.id !== op.id);
      await deleteOngoingSession(actor, run.id, op.id);
      const r = await saveOutline(); if (r.ok === false) return fail(r.error);
      return finish();
    }
    case 'move-module': {
      const i = outline.modules.findIndex((m) => m.id === op.id); const j = i + op.dir;
      if (i < 0 || j < 0 || j >= outline.modules.length) return finish();
      [outline.modules[i], outline.modules[j]] = [outline.modules[j], outline.modules[i]];
      const r = await saveOutline(); if (r.ok === false) return fail(r.error);
      return finish();
    }
    case 'add-step': {
      const m = mod(op.moduleId);
      if (!m || !(op.kind in KIND_TYPE)) return fail('No such session.');
      const r = await upsertStepDraft(actor, courseId, { type: KIND_TYPE[op.kind], title: `New ${KIND_LABEL[op.kind]} step`, settings: {} });
      if (r.ok === false) return fail(r.error);
      m.steps.push({ stepId: r.stepId, required: true, unlock: { kind: 'open' } } as OutlineStepRef);
      const o = await saveOutline(); if (o.ok === false) return fail(o.error);
      return finish();
    }
    case 'step': {
      const s = stepOf(op.id);
      if (!s) return fail('No such step.');
      const p = op.patch;
      const settings: StepSettings = { ...(s.settings ?? {}) };
      const promptKey = s.type === 'practice' ? 'practice' : 'prompt';
      if (p.prompt !== undefined) { if (p.prompt.trim()) settings[promptKey] = p.prompt.trim().slice(0, 2000); else delete settings[promptKey]; }
      if (p.due !== undefined) { if (p.due) settings.due = p.due; else delete settings.due; }
      if (p.timeLimit !== undefined) { if (p.timeLimit && p.timeLimit > 0) settings.minutes = Math.round(p.timeLimit); else delete settings.minutes; }
      if (p.when !== undefined) { if (p.when.trim()) settings.when = p.when.trim().slice(0, 120); else delete settings.when; }
      if (p.where !== undefined) { if (p.where.trim()) settings.where = p.where.trim().slice(0, 160); else delete settings.where; }
      let refs = s.refs ?? {};
      if (p.href !== undefined || p.fileName !== undefined) {
        const url = (p.href ?? refs.links?.[0]?.url ?? '').trim();
        const title = (p.fileName ?? refs.links?.[0]?.title ?? '').trim() || url;
        refs = { ...refs, links: url ? [{ url: url.slice(0, 500), title: title.slice(0, 160) }] : [] };
      }
      const r = await upsertStepDraft(actor, courseId, {
        stepId: op.id, title: p.title !== undefined ? str(p.title, 200) || s.title : s.title, settings, refs,
        ...(p.body !== undefined ? { bodyHtml: bodyToHtml(p.body) } : {}),
      });
      if (r.ok === false) return fail(r.error);
      if (p.required !== undefined) {
        for (const m of outline.modules) for (const ref of m.steps) if (ref.stepId === op.id) ref.required = p.required;
        const o = await saveOutline(); if (o.ok === false) return fail(o.error);
      }
      return finish();
    }
    case 'remove-step': {
      const m = mod(op.moduleId);
      if (!m) return fail('No such session.');
      m.steps = m.steps.filter((s) => s.stepId !== op.id);
      const o = await saveOutline(); if (o.ok === false) return fail(o.error);
      return finish();
    }
    case 'move-step': {
      const m = mod(op.moduleId);
      if (!m) return fail('No such session.');
      const i = m.steps.findIndex((s) => s.stepId === op.id); const j = i + op.dir;
      if (i < 0 || j < 0 || j >= m.steps.length) return finish();
      [m.steps[i], m.steps[j]] = [m.steps[j], m.steps[i]];
      const o = await saveOutline(); if (o.ok === false) return fail(o.error);
      return finish();
    }
    case 'ongoing': {
      const m = mod(op.moduleId);
      if (!m) return fail('No such session.');
      if (!op.on) { const r = await deleteOngoingSession(actor, run.id, op.moduleId); if (r.ok === false) return fail(r.error); return finish(); }
      const have = (await listOngoingSessions(run.id)).find((s) => s.moduleId === op.moduleId);
      let stepId = have?.stepId || m.steps[0]?.stepId;
      if (!stepId) {
        const r = await upsertStepDraft(actor, courseId, { type: 'reflection', title: 'Daily entry', settings: { prompt: 'What did you do today, and what did you notice?' } });
        if (r.ok === false) return fail(r.error);
        stepId = r.stepId;
        m.steps.push({ stepId, required: false, unlock: { kind: 'open' } } as OutlineStepRef);
        const o = await saveOutline(); if (o.ok === false) return fail(o.error);
      }
      const p = op.patch ?? {};
      const today = new Date().toISOString().slice(0, 10);
      const everyDays = p.everyDays ?? (p.every ? (p.every === 'week' ? 7 : 1) : have?.everyDays ?? 1);
      const r = await saveOngoingSession(actor, run.id, {
        moduleId: op.moduleId, stepId, everyDays, start: p.start ?? have?.start ?? today, end: p.end === undefined ? have?.end ?? null : p.end,
        closes: p.closes ?? have?.closes ?? true, readFirst: p.readFirst ?? have?.readFirst ?? false, show: p.show ?? have?.show ?? 5,
      });
      if (r.ok === false) return fail(r.error);
      return finish();
    }
    case 'plan': {
      const r = await saveIntervalPlan(actor, run.id, op.moduleId, op.key, { note: op.note ?? null, items: op.items ?? [] });
      if (r.ok === false) return fail(r.error);
      return finish();
    }
    case 'adopt': {
      const a = await adoptLatestVersion(actor, run.id);
      if (a.ok === false) return fail(a.error);
      const [{ n }] = await db<Array<{ n: number }>>`SELECT COUNT(DISTINCT e.id)::int AS n FROM lms_enrolments e JOIN lms_step_state s ON s.enrolment_id = e.id WHERE e.run_id = ${run.id} AND e.status <> 'withdrawn'`;
      const [v] = await db<Array<{ no: number }>>`SELECT v.version_no AS no FROM lms_courses c JOIN lms_course_versions v ON v.id = c.published_version_id WHERE c.id = ${courseId}`;
      return finish({ changeKind: 'structural', versionNo: v?.no ?? 0, partway: n, adopted: true });
    }
    case 'publish': {
      const pub = await publishCourse(actor, courseId, 'Edited in the workspace');
      if (pub.ok === false) return fail(pub.error);
      const [{ n }] = await db<Array<{ n: number }>>`
        SELECT COUNT(DISTINCT e.id)::int AS n FROM lms_enrolments e JOIN lms_step_state s ON s.enrolment_id = e.id WHERE e.run_id = ${run.id} AND e.status <> 'withdrawn'
      `;
      let adopted = false;
      const cur = await getRun(run.id);
      const course = await getCourseById(courseId);
      if (cur && course?.publishedVersionId && cur.courseVersionId !== course.publishedVersionId && (pub.changeKind === 'fix' || op.adopt)) {
        const a = await adoptLatestVersion(actor, run.id);
        if (a.ok === false) return fail(a.error);
        adopted = true;
      } else if (cur && cur.courseVersionId === course?.publishedVersionId) adopted = true;
      return finish({ changeKind: pub.changeKind, versionNo: pub.versionNo, partway: n, adopted });
    }
    default:
      return fail('Unknown edit.');
  }
}

// ── people: search, add, invite links ───────────────────────────────────────
export async function searchWorkspaceMembers(viewer: LmsViewer, courseSlug: string, q: string): Promise<{ ok: true; people: Array<{ id: string; name: string }> } | { ok: false; error: string }> {
  const view = await getWorkspaceView(viewer, courseSlug);
  const actor = view ? workspaceActor(viewer, view) : null;
  if (!view?.run || !actor) return { ok: false, error: 'Only the guides of this workspace can do that.' };
  const term = q.trim().replace(/[%_\\]/g, '');
  if (term.length < 2) return { ok: true, people: [] };
  const rows = await db<Array<{ id: string; name: string }>>`
    SELECT u.id, COALESCE(u.display_name, 'Someone') AS name
    FROM user_organizations uo JOIN users u ON u.id = uo.user_id
    WHERE uo.org_id = ${view.course.orgId} AND u.display_name ILIKE ${'%' + term + '%'}
      AND NOT EXISTS (SELECT 1 FROM lms_enrolments e WHERE e.run_id = ${view.run.id} AND e.user_id = u.id AND e.status <> 'withdrawn')
    ORDER BY u.display_name LIMIT 10
  `;
  return { ok: true, people: rows };
}

/** Seat someone through the engine's own enrolment. The caller has already shown the right to do so (a guide, or a valid invite). */
async function seat(orgId: string, runId: string, userId: string): Promise<WriteResult> {
  const run = await getRun(runId);
  if (!run) return { ok: false, error: 'No such group.' };
  if (run.status !== 'open') return { ok: false, error: 'This group is not open yet.' };
  if (run.capacity) {
    const [{ n }] = await db<Array<{ n: number }>>`SELECT COUNT(*)::int AS n FROM lms_enrolments WHERE run_id = ${runId} AND status <> 'withdrawn'`;
    const [mine] = await db`SELECT 1 FROM lms_enrolments WHERE run_id = ${runId} AND user_id = ${userId} AND status <> 'withdrawn'`;
    if (!mine && n >= run.capacity) return { ok: false, error: 'This group is full.' };
  }
  const r = await enrol({ userId, roles: { [orgId]: 'guide' } }, runId);
  return r.ok === true ? { ok: true } : { ok: false, error: r.error };
}

/** A guide adds a person who is a member of the organisation. */
export async function addWorkspaceMember(viewer: LmsViewer, courseSlug: string, userId: string): Promise<WriteResult> {
  const view = await getWorkspaceView(viewer, courseSlug);
  const actor = view ? workspaceActor(viewer, view) : null;
  if (!view?.run || !actor) return { ok: false, error: 'Only the guides of this workspace can do that.' };
  const [m] = await db`SELECT 1 FROM user_organizations WHERE org_id = ${view.course.orgId} AND user_id = ${userId}`;
  if (!m) return { ok: false, error: 'That person is not a member of this organisation.' };
  return seat(view.course.orgId, view.run.id, userId);
}

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export interface WorkspaceInvite { id: string; label: string | null; createdAt: Date; expiresAt: Date | null; maxUses: number | null; uses: number; revoked: boolean }

/** A guide makes an invite link. The token is returned ONCE; only its hash is stored. */
export async function createWorkspaceInvite(viewer: LmsViewer, courseSlug: string, opts: { label?: string; maxUses?: number | null; days?: number | null; expiresAt?: Date } = {}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const view = await getWorkspaceView(viewer, courseSlug);
  const actor = view ? workspaceActor(viewer, view) : null;
  if (!view?.run || !actor) return { ok: false, error: 'Only the guides of this workspace can do that.' };
  if (!(await workspaceSettingsAvailable())) return { ok: false, error: 'Invite links are not switched on yet.' };
  const token = randomBytes(24).toString('base64url');
  const days = opts.days && opts.days > 0 ? Math.min(opts.days, 365) : 30;
  const max = opts.maxUses && opts.maxUses > 0 ? Math.min(Math.round(opts.maxUses), 1000) : null;
  await db`
    INSERT INTO workspace_invites (id, host_type, host_id, token_hash, label, created_by, expires_at, max_uses)
    VALUES (${newId()}, 'lms_run', ${view.run.id}, ${hashToken(token)}, ${str(opts.label, 80) || null}, ${actor.userId}, ${opts.expiresAt ?? new Date(Date.now() + days * 86_400_000)}, ${max})
  `;
  return { ok: true, token };
}

export async function listWorkspaceInvites(viewer: LmsViewer, courseSlug: string): Promise<WorkspaceInvite[] | null> {
  const view = await getWorkspaceView(viewer, courseSlug);
  if (!view?.run || !workspaceActor(viewer, view) || !(await workspaceSettingsAvailable())) return null;
  const rows = await db<Array<{ id: string; label: string | null; created_at: Date; expires_at: Date | null; max_uses: number | null; uses: number; revoked_at: Date | null }>>`
    SELECT id, label, created_at, expires_at, max_uses, uses, revoked_at FROM workspace_invites WHERE host_type = 'lms_run' AND host_id = ${view.run.id} ORDER BY created_at DESC LIMIT 50
  `;
  return rows.map((r) => ({ id: r.id, label: r.label, createdAt: r.created_at, expiresAt: r.expires_at, maxUses: r.max_uses, uses: r.uses, revoked: Boolean(r.revoked_at) }));
}

export async function revokeWorkspaceInvite(viewer: LmsViewer, courseSlug: string, inviteId: string): Promise<WriteResult> {
  const view = await getWorkspaceView(viewer, courseSlug);
  if (!view?.run || !workspaceActor(viewer, view)) return { ok: false, error: 'Only the guides of this workspace can do that.' };
  await db`UPDATE workspace_invites SET revoked_at = NOW() WHERE id = ${inviteId} AND host_type = 'lms_run' AND host_id = ${view.run.id} AND revoked_at IS NULL`;
  return { ok: true };
}

/** Someone follows an invite link. Needs sign-in; refuses a link that is unknown, revoked, expired or used up; seats through the engine. */
export async function redeemWorkspaceInvite(viewer: LmsViewer, token: string): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  if (!viewer.userId) return { ok: false, error: 'Sign in first.' };
  if (!(await workspaceSettingsAvailable())) return { ok: false, error: 'This link is not available.' };
  const [inv] = await db<Array<{ id: string; host_id: string; expires_at: Date | null; max_uses: number | null; uses: number; revoked_at: Date | null }>>`
    SELECT id, host_id, expires_at, max_uses, uses, revoked_at FROM workspace_invites WHERE token_hash = ${hashToken(token)} AND host_type = 'lms_run'
  `;
  if (!inv || inv.revoked_at) return { ok: false, error: 'This invite link is not valid any more.' };
  if (inv.expires_at && inv.expires_at.getTime() < Date.now()) return { ok: false, error: 'This invite link has expired.' };
  const run = await getRun(inv.host_id);
  if (!run) return { ok: false, error: 'This invite link is not valid any more.' };
  const [already] = await db`SELECT 1 FROM lms_enrolments WHERE run_id = ${run.id} AND user_id = ${viewer.userId} AND status <> 'withdrawn'`;
  const course = await getCourseById(run.courseId);
  if (!course) return { ok: false, error: 'This invite link is not valid any more.' };
  if (!already) {
    // Count the use first, only while the link still has uses left: two people cannot both take the last one.
    const used = await db`UPDATE workspace_invites SET uses = uses + 1 WHERE id = ${inv.id} AND revoked_at IS NULL AND (max_uses IS NULL OR uses < max_uses) RETURNING id`;
    if (!used.length) return { ok: false, error: 'This invite link has been used up.' };
    const s = await seat(run.orgId, run.id, viewer.userId);
    if (s.ok === false) { await db`UPDATE workspace_invites SET uses = uses - 1 WHERE id = ${inv.id}`; return { ok: false, error: s.error }; }
  }
  return { ok: true, slug: course.slug };
}
export type { Course };

/** Does the draft differ from the published version? Compares what a publish would freeze, so a bump of a timestamp alone never counts. */
async function draftDiffers(c: Course, outline: Outline, steps: Array<{ stepId: string; title: string; summary: string | null; bodyHtml: string | null; settings: StepSettings; refs: unknown }>): Promise<boolean> {
  if (!c.publishedVersionId) return true;
  const [pv] = await db<Array<{ outline: Outline; title: string; summary: string | null; description_html: string | null }>>`SELECT outline, title, summary, description_html FROM lms_course_versions WHERE id = ${c.publishedVersionId}`;
  if (!pv) return true;
  if (pv.title !== c.title || (pv.summary ?? null) !== (c.summary ?? null) || (pv.description_html ?? null) !== (c.descriptionHtml ?? null)) return true;
  const shape = (o: Outline) => JSON.stringify(o.modules.map((m) => ({ id: m.id, title: m.title, summary: m.summary ?? null, look: m.look ?? null, steps: m.steps.map((s) => ({ stepId: s.stepId, required: s.required !== false, unlock: s.unlock ?? null })) })));
  if (shape(pv.outline) !== shape(outline)) return true;
  const ids = outline.modules.flatMap((m) => m.steps.map((s) => s.stepId));
  if (!ids.length) return false;
  const latest = await db<Array<{ step_id: string; content_hash: string }>>`
    SELECT DISTINCT ON (step_id) step_id, content_hash FROM lms_step_versions WHERE step_id IN ${db(ids)} ORDER BY step_id, version_no DESC
  `;
  const have = new Map(latest.map((l) => [l.step_id, l.content_hash]));
  const byId = new Map(steps.map((s) => [s.stepId, s]));
  for (const id of ids) {
    const s = byId.get(id);
    if (!s || have.get(id) !== hashContent([s.title, s.summary, s.bodyHtml, s.settings, s.refs])) return true;
  }
  return false;
}
