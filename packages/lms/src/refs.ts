// ============================================================================
// What a step POINTS AT on the rest of the network: a standing meeting, an
// event, a workshop, a forum thread. Sophia reads these; it never owns them.
// ============================================================================
import { db } from '@elkdonis/db';
import type { LmsViewer, PublishedCourse, Run, WriteResult } from './types';
import { isRunStaff, getRun } from './delivery';
import { getCourseById, getCourseVersion } from './content';

export interface ThreadRef {
  id: string; slug: string; title: string; kind: string; excerpt: string | null;
  orgId: string; orgSlug: string; orgName: string;
  scheduledAt: Date | null; durationMinutes: number | null; recurring: boolean;
  location: string | null; isOnline: boolean; hasTalkRoom: boolean; replyCount: number;
  /** False when the thread is gone, unpublished, or not public. The step then says so plainly. */
  available: boolean;
}

export async function getThreadRefs(ids: string[]): Promise<Record<string, ThreadRef>> {
  if (!ids.length) return {};
  const rows = await db<Array<{
    id: string; slug: string; title: string; kind: string; excerpt: string | null; org_id: string; org_slug: string; org_name: string;
    scheduled_at: Date | null; duration_minutes: number | null; rec: boolean; location: string | null; is_online: boolean | null;
    talk: boolean; reply_count: number | null; status: string; visibility: string;
  }>>`
    SELECT t.id, t.slug, t.title, t.kind, t.excerpt, t.org_id, o.slug AS org_slug, o.name AS org_name,
           t.scheduled_at, t.duration_minutes, (t.recurrence_pattern IS NOT NULL) AS rec, t.location, t.is_online,
           (t.nextcloud_talk_token IS NOT NULL) AS talk, t.reply_count, t.status, t.visibility
    FROM threads t JOIN organizations o ON o.id = t.org_id WHERE t.id = ANY(${ids})
  `;
  return Object.fromEntries(rows.map((r) => [r.id, {
    id: r.id, slug: r.slug, title: r.title, kind: r.kind, excerpt: r.excerpt, orgId: r.org_id, orgSlug: r.org_slug, orgName: r.org_name,
    scheduledAt: r.scheduled_at, durationMinutes: r.duration_minutes, recurring: r.rec, location: r.location, isOnline: Boolean(r.is_online),
    hasTalkRoom: r.talk, replyCount: r.reply_count ?? 0,
    // Sophia links out; the forum still applies its own rules when they arrive.
    available: r.status === 'published' && r.visibility === 'PUBLIC',
  } satisfies ThreadRef]));
}

// ── run discussions (community classroom) ───────────────────────────────────
export async function getRunDiscussion(runId: string, stepId: string): Promise<ThreadRef | null> {
  const [row] = await db<Array<{ thread_id: string }>>`SELECT thread_id FROM lms_run_discussions WHERE run_id = ${runId} AND step_id = ${stepId}`;
  if (!row) return null;
  return (await getThreadRefs([row.thread_id]))[row.thread_id] ?? null;
}

/** The host supplies the thread writer (services' createThread) — Sophia does not depend on it. */
export type CreateDiscussionThread = (input: { orgId: string; authorId: string; section: string; title: string; bodyHtml: string }) => Promise<{ id: string }>;

/**
 * Open one conversation per step for a cohort/circle run, in the run's
 * discussion feed, started by the guide who asks. Idempotent.
 */
export async function openRunDiscussions(viewer: LmsViewer, runId: string, create: CreateDiscussionThread, stepUrl: (stepSlug: string) => string): Promise<WriteResult<{ opened: number }>> {
  const run: Run | null = await getRun(runId);
  if (!run || !viewer.userId || !(await isRunStaff(viewer, run))) return { ok: false, error: 'Guides only.' };
  if (!run.discussionFeed) return { ok: false, error: 'This run has no forum category to talk in.' };
  const [feed] = await db`SELECT 1 FROM org_feeds WHERE org_id = ${run.orgId} AND slug = ${run.discussionFeed}`;
  if (!feed) return { ok: false, error: 'That forum category doesn’t exist.' };
  const course = await getCourseById(run.courseId);
  const published: PublishedCourse | null = course ? await getCourseVersion(course, run.courseVersionId) : null;
  if (!published) return { ok: false, error: 'Nothing published.' };
  const have = new Set((await db<Array<{ step_id: string }>>`SELECT step_id FROM lms_run_discussions WHERE run_id = ${runId}`).map((r) => r.step_id));
  let opened = 0;
  for (const s of published.steps) {
    if (have.has(s.stepId)) continue;
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // eslint-disable-next-line no-await-in-loop
    const t = await create({
      orgId: run.orgId, authorId: viewer.userId, section: run.discussionFeed,
      title: `${s.title} — ${run.title}`,
      bodyHtml: `<p>${esc(s.summary ?? s.title)}</p><p>A place to talk about this step of <em>${esc(published.course.title)}</em>. <a href="${stepUrl(s.slug)}">Open the step →</a></p>`,
    });
    // eslint-disable-next-line no-await-in-loop
    await db`INSERT INTO lms_run_discussions (run_id, step_id, thread_id) VALUES (${runId}, ${s.stepId}, ${t.id}) ON CONFLICT DO NOTHING`;
    opened++;
  }
  return { ok: true, opened };
}
