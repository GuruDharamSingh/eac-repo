// ============================================================================
// A course's POOL — the drafting table beside the outline (migration 145).
// References, never copies. Never published; learners never see it.
// ============================================================================
import { db } from '@elkdonis/db';
import type { LmsViewer, StepMedia, StepRefs, WriteResult } from './types';
import { canEditCourse, getCourseById, upsertStepDraft, getDraft } from './content';
import { editOutline } from './authoring';
import { assertPublicUrl, unfurl } from './unfurl';
import { newId } from './util';

export type PoolKind = 'thread' | 'url' | 'media' | 'note';
export interface PoolItem {
  id: string; kind: PoolKind; threadId: string | null; url: string | null; title: string; description: string | null;
  imageUrl: string | null; siteName: string | null; mediaKind: StepMedia['kind'] | null; note: string | null; tags: string[];
  addedBy: string | null; createdAt: Date;
  /** For a thread: what it is now (null if it has gone). */
  thread: { kind: string; slug: string; orgName: string; available: boolean } | null;
  /** Steps of the WORKING outline that draw on it. Derived, never stored. */
  usedIn: Array<{ stepId: string; title: string }>;
}

/** Accepts a thread id or any network URL containing /t/<id>/. */
export const threadIdFromInput = (raw: string): string | null => raw.match(/\/t\/([A-Za-z0-9_-]{6,})/)?.[1] ?? (/^[A-Za-z0-9_-]{6,40}$/.test(raw) ? raw : null);

async function guard(viewer: LmsViewer, courseId: string) {
  const course = await getCourseById(courseId);
  if (!course || !(await canEditCourse(viewer, course))) return null;
  return course;
}

export async function listPool(viewer: LmsViewer, courseId: string, opts: { tag?: string; unusedOnly?: boolean } = {}): Promise<PoolItem[] | null> {
  if (!(await guard(viewer, courseId))) return null;
  const rows = await db<Array<{
    id: string; kind: PoolKind; thread_id: string | null; url: string | null; title: string; description: string | null; image_url: string | null;
    site_name: string | null; media_kind: StepMedia['kind'] | null; note: string | null; tags: string[]; added_by: string | null; created_at: Date;
    t_kind: string | null; t_slug: string | null; t_org: string | null; t_ok: boolean | null;
  }>>`
    SELECT p.*, t.kind AS t_kind, t.slug AS t_slug, o.name AS t_org, (t.status = 'published' AND t.visibility = 'PUBLIC') AS t_ok
    FROM lms_pool_items p LEFT JOIN threads t ON t.id = p.thread_id LEFT JOIN organizations o ON o.id = t.org_id
    WHERE p.course_id = ${courseId} AND p.archived_at IS NULL ${opts.tag ? db`AND ${opts.tag} = ANY(p.tags)` : db``}
    ORDER BY p.created_at DESC
  `;
  // Used/unused from the working outline's drafts.
  const drafts = await db<Array<{ step_id: string; title: string; refs: StepRefs }>>`
    SELECT d.step_id, d.title, d.refs FROM lms_step_drafts d JOIN lms_steps s ON s.id = d.step_id, lms_courses c
    WHERE s.course_id = ${courseId} AND c.id = s.course_id
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.draft_outline->'modules') m, jsonb_array_elements(m->'steps') st WHERE st->>'stepId' = s.id)
  `;
  const uses = (it: { thread_id: string | null; url: string | null }) => drafts.filter((d) =>
    (it.thread_id && d.refs?.threadId === it.thread_id) ||
    (it.url && ((d.refs?.links ?? []).some((l) => l.url === it.url) || (d.refs?.media ?? []).some((m) => m.url === it.url)))
  ).map((d) => ({ stepId: d.step_id, title: d.title }));
  const items = rows.map((r): PoolItem => ({
    id: r.id, kind: r.kind, threadId: r.thread_id, url: r.url, title: r.title, description: r.description, imageUrl: r.image_url, siteName: r.site_name,
    mediaKind: r.media_kind, note: r.note, tags: r.tags ?? [], addedBy: r.added_by, createdAt: r.created_at,
    thread: r.kind === 'thread' ? (r.t_slug ? { kind: r.t_kind!, slug: r.t_slug, orgName: r.t_org!, available: Boolean(r.t_ok) } : null) : null,
    usedIn: uses(r),
  }));
  return opts.unusedOnly ? items.filter((i) => i.usedIn.length === 0 && i.kind !== 'note') : items;
}

const cleanTags = (raw: string | string[] | undefined) => [...new Set((Array.isArray(raw) ? raw : (raw ?? '').split(',')).map((t) => t.trim().toLowerCase().replace(/^#/, '').slice(0, 40)).filter(Boolean))].slice(0, 12);

export interface AddToPoolInput { input?: string; note?: string; tags?: string | string[]; media?: { url: string; kind: StepMedia['kind']; title: string } }
/**
 * One box for everything: a network thread link (or id) becomes a thread
 * reference; any other link is captured with its own title/description/image;
 * text that is not a link is a note. `media` adds a file already in storage.
 */
export async function addToPool(viewer: LmsViewer, courseId: string, a: AddToPoolInput): Promise<WriteResult<{ itemId: string; kind: PoolKind; duplicate: boolean }>> {
  const course = await guard(viewer, courseId);
  if (!course) return { ok: false, error: 'You can’t edit this course.' };
  const raw = (a.input ?? '').trim();
  const tags = cleanTags(a.tags);
  const note = a.note?.trim() || null;
  const id = newId();
  const base = { id, course_id: courseId, org_id: course.orgId, note, tags, added_by: viewer.userId };

  if (a.media) {
    const [dup] = await db<Array<{ id: string }>>`SELECT id FROM lms_pool_items WHERE course_id = ${courseId} AND url = ${a.media.url} AND archived_at IS NULL`;
    if (dup) return { ok: true, itemId: dup.id, kind: 'media', duplicate: true };
    await db`INSERT INTO lms_pool_items ${db({ ...base, kind: 'media', url: a.media.url, title: a.media.title || 'A file', media_kind: a.media.kind } as never)}`;
    return { ok: true, itemId: id, kind: 'media', duplicate: false };
  }
  if (!raw) return { ok: false, error: 'Paste a link, or write a note.' };

  const threadId = threadIdFromInput(raw);
  if (threadId) {
    // The same rule search applies: a pasted id must not reveal the title or
    // excerpt of a thread this author could not open themselves.
    const orgs = Object.keys(viewer.roles);
    const [t] = await db<Array<{ id: string; title: string; excerpt: string | null }>>`
      SELECT id, title, excerpt FROM threads
      WHERE id = ${threadId} AND (
        ${viewer.isGlobalAdmin ? db`TRUE` : db`FALSE`}
        OR (status = 'published' AND (visibility = 'PUBLIC' OR (visibility = 'ORGANIZATION' AND org_id = ANY(${orgs}))))
        OR author_id = ${viewer.userId}
      )`;
    if (!t && /\/t\//.test(raw)) return { ok: false, error: 'There’s no thread there that you can open.' };
    if (t) {
      const [dup] = await db<Array<{ id: string }>>`SELECT id FROM lms_pool_items WHERE course_id = ${courseId} AND thread_id = ${t.id} AND archived_at IS NULL`;
      if (dup) return { ok: true, itemId: dup.id, kind: 'thread', duplicate: true };
      await db`INSERT INTO lms_pool_items ${db({ ...base, kind: 'thread', thread_id: t.id, title: t.title, description: t.excerpt } as never)}`;
      return { ok: true, itemId: id, kind: 'thread', duplicate: false };
    }
  }
  if (/^https?:\/\/\S+$/i.test(raw)) {
    // A link readers could never open has no place in a course.
    try { await assertPublicUrl(raw); } catch { return { ok: false, error: 'That link isn’t on the public web, so readers couldn’t open it.' }; }
    const u = await unfurl(raw);
    const [dup] = await db<Array<{ id: string }>>`SELECT id FROM lms_pool_items WHERE course_id = ${courseId} AND url = ${u.url} AND archived_at IS NULL`;
    if (dup) return { ok: true, itemId: dup.id, kind: 'url', duplicate: true };
    await db`INSERT INTO lms_pool_items ${db({ ...base, kind: 'url', url: u.url, title: u.title, description: u.description, image_url: u.imageUrl, site_name: u.siteName } as never)}`;
    return { ok: true, itemId: id, kind: 'url', duplicate: false };
  }
  await db`INSERT INTO lms_pool_items ${db({ ...base, kind: 'note', title: raw.split('\n')[0].slice(0, 120), note: raw } as never)}`;
  return { ok: true, itemId: id, kind: 'note', duplicate: false };
}

export async function updatePoolItem(viewer: LmsViewer, itemId: string, p: { title?: string; note?: string; tags?: string | string[]; archive?: boolean }): Promise<WriteResult> {
  const [it] = await db<Array<{ course_id: string }>>`SELECT course_id FROM lms_pool_items WHERE id = ${itemId}`;
  if (!it || !(await guard(viewer, it.course_id))) return { ok: false, error: 'Not yours to change.' };
  if (p.archive) await db`UPDATE lms_pool_items SET archived_at = NOW() WHERE id = ${itemId}`;
  else await db`UPDATE lms_pool_items SET title = COALESCE(${p.title?.trim() || null}, title), note = CASE WHEN kind = 'note' THEN note ELSE ${p.note?.trim() || null} END, tags = ${cleanTags(p.tags)} WHERE id = ${itemId}`;
  return { ok: true };
}

/**
 * Pull a pool item into the course. With `stepId`, attach it to that step's
 * working copy; with `moduleId`, make a new step from it of the fitting kind.
 */
export async function usePoolItem(viewer: LmsViewer, itemId: string, target: { stepId?: string; moduleId?: string }): Promise<WriteResult<{ stepId: string }>> {
  const [it] = await db<Array<{ course_id: string; kind: PoolKind; thread_id: string | null; url: string | null; title: string; description: string | null; image_url: string | null; site_name: string | null; media_kind: StepMedia['kind'] | null; note: string | null; t_kind: string | null }>>`
    SELECT p.*, t.kind AS t_kind FROM lms_pool_items p LEFT JOIN threads t ON t.id = p.thread_id WHERE p.id = ${itemId} AND p.archived_at IS NULL
  `;
  if (!it || !(await guard(viewer, it.course_id))) return { ok: false, error: 'Not yours to use.' };
  if (it.kind === 'thread' && !it.thread_id) return { ok: false, error: 'That thread has gone.' };
  let stepId = target.stepId;
  if (!stepId) {
    if (!target.moduleId) return { ok: false, error: 'Pick a step or a module.' };
    const live = ['meeting', 'workshop', 'event', 'reading_group'].includes(it.t_kind ?? '');
    const type = it.kind === 'thread' ? (live ? 'session' : 'thread') : it.kind === 'note' ? 'reading' : it.kind === 'media' && (it.media_kind === 'audio' || it.media_kind === 'video') ? 'practice' : 'resource';
    const r = await editOutline(viewer, it.course_id, { op: 'add-step', moduleId: target.moduleId, title: it.title, type });
    if (r.ok === false || !r.stepId) return { ok: false, error: r.ok === false ? r.error : 'Could not add the step.' };
    stepId = r.stepId;
  }
  const draft = await getDraft(viewer, it.course_id);
  const step = draft?.steps.find((s) => s.stepId === stepId);
  if (!step) return { ok: false, error: 'No such step.' };
  const refs: StepRefs = { ...step.refs };
  if (it.kind === 'thread') {
    // A step points at ONE thread; never replace it silently.
    if (refs.threadId && refs.threadId !== it.thread_id) return { ok: false, error: `“${step.title}” already points at another thread. Clear it in the step first, or make a new step.` };
    refs.threadId = it.thread_id!;
  }
  if (it.kind === 'url' && !(refs.links ?? []).some((l) => l.url === it.url)) refs.links = [...(refs.links ?? []), { url: it.url!, title: it.title, description: it.description ?? undefined, imageUrl: it.image_url ?? undefined, siteName: it.site_name ?? undefined }];
  if (it.kind === 'media' && !(refs.media ?? []).some((m) => m.url === it.url)) refs.media = [...(refs.media ?? []), { kind: it.media_kind ?? 'file', url: it.url!, title: it.title }];
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bodyHtml = it.kind === 'note' && !target.stepId ? it.note!.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join('') : undefined;
  const r = await upsertStepDraft(viewer, it.course_id, { stepId, title: step.title, refs, ...(bodyHtml ? { bodyHtml } : {}), ...(!target.stepId && it.description && !step.summary ? { summary: it.description.slice(0, 200) } : {}) });
  return r.ok === false ? r : { ok: true, stepId };
}
