/**
 * The dock's data (brief §3.3, shape B, slice 1; 2026-11-06): what a signed-in
 * person's corner box shows on the page they are on. Reads only.
 *
 *   step  the first open step of their course (the LMS's own outline), and, for a
 *         task step, the entry's status and what `presentAction` needs to draw it.
 *   post  when the page is one of an org's posts and the person is an owner or
 *         guide there: the post entries that apply (publish a draft; lead the site
 *         with a published public post, or stop).
 *
 * The LMS functions come from the host (`lms`): this package does not depend on
 * `@elkdonis/lms`, and `@elkdonis/lms` core never imports the registry.
 * Nothing here writes: `getLearnerOutline` is called only when an enrolment exists,
 * so its default-run fallback (`ensureDefaultRun`) is not reached, and task steps
 * are not settled here (the lesson settles them when it renders).
 */
import { db } from '@elkdonis/db';
import { canManageOrgPeople } from '@elkdonis/services';
import type { ActionLinks, ActionStatus } from '../types';
import { actionMeta } from '../catalogue';
import { actionStatus } from './status';
import { resolveActionOrg } from './org';

/** The parts of `@elkdonis/lms` the dock reads, passed in by the host. Structural on purpose. */
export interface DockLms {
  getCourseBySlug(slug: string): Promise<{ id: string; slug: string; title: string; publishedVersionId: string | null } | null>;
  getActiveEnrolment(userId: string, courseId: string): Promise<{ id: string; status: string } | null>;
  listMyEnrolments(userId: string): Promise<Array<{ courseId: string; courseSlug: string; status: string }>>;
  getLearnerOutline(
    viewer: { userId: string | null; roles: Record<string, string> },
    course: { courseId: string },
  ): Promise<{
    continueStep: DockOutlineStep | null;
    steps: DockOutlineStep[];
    doneRequired: number;
    totalRequired: number;
  } | null>;
  stepTask(step: DockOutlineStep): { id: string; scope?: 'person' | 'org'; params?: Record<string, string> } | null;
}

interface DockOutlineStep {
  slug: string;
  title: string;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: Record<string, any>;
  status: string | null;
  access: { allowed: boolean };
}

export interface DockStep {
  courseSlug: string;
  courseTitle: string;
  stepSlug: string;
  stepTitle: string;
  /** `/learn/<course>/<step>` on this host. */
  href: string;
  doneRequired: number;
  totalRequired: number;
  /** Present for a task step: the entry, its status, and the inputs of `presentAction`. */
  task: null | {
    id: string;
    params: Record<string, string> | null;
    orgId: string | null;
    status: ActionStatus;
  };
}

export interface DockPostAction {
  id: 'thread-publish' | 'thread-pin';
  label: string;
  busyLabel: string;
  /** What `runAction(id, input, { subject })` receives. */
  input?: Record<string, unknown>;
}

export interface DockPost {
  id: string;
  title: string;
  status: string;
  /** One line: the entry's status detail. */
  detail: string | null;
  actions: DockPostAction[];
}

export interface DockData {
  step: DockStep | null;
  post: DockPost | null;
  /** For the client's `presentAction` (`links` there). */
  links: Pick<ActionLinks, 'artdirect' | 'nextcloud'>;
}

export interface DockOptions {
  userId: string;
  /** The browser's path on this host (`usePathname()`). */
  path: string | null;
  links: ActionLinks;
  lms: DockLms;
  /** Course slugs tried first, in order; then the person's other enrolments. Default: getting-started. */
  courses?: readonly string[];
  /** Where a step lives; default `/learn/<course>/<step>`. */
  stepHref?: (courseSlug: string, stepSlug: string) => string;
}

const isDone = (s: { status: string | null }) => s.status === 'completed' || s.status === 'waived';

/** The person's current step, or null (no enrolment, finished, or nothing open). */
export async function dockStep(opts: DockOptions): Promise<DockStep | null> {
  const { userId, lms } = opts;
  const preferred = opts.courses ?? ['getting-started'];
  const candidates: Array<{ slug: string; id: string; title: string }> = [];
  for (const slug of preferred) {
    const c = await lms.getCourseBySlug(slug);
    if (c?.publishedVersionId) candidates.push({ slug: c.slug, id: c.id, title: c.title });
  }
  for (const e of await lms.listMyEnrolments(userId)) {
    if (candidates.some((c) => c.id === e.courseId)) continue;
    if (e.status === 'withdrawn' || e.status === 'completed') continue;
    const c = await lms.getCourseBySlug(e.courseSlug);
    if (c?.publishedVersionId) candidates.push({ slug: c.slug, id: c.id, title: c.title });
  }
  for (const c of candidates) {
    const enrolment = await lms.getActiveEnrolment(userId, c.id);
    // Only an enrolled course: without one, getLearnerOutline would create the default run.
    if (!enrolment || enrolment.status === 'completed') continue;
    const o = await lms.getLearnerOutline({ userId, roles: {} }, { courseId: c.id });
    if (!o) continue;
    const step = o.continueStep ?? o.steps.find((s) => !isDone(s) && s.access.allowed) ?? null;
    if (!step) continue;
    const t = lms.stepTask(step);
    let task: DockStep['task'] = null;
    if (t) {
      const orgId = t.scope === 'org' ? await resolveActionOrg(userId, null) : null;
      const params = t.params && Object.keys(t.params).length ? t.params : null;
      const status = await actionStatus(t.id, { userId, orgId, links: opts.links, params });
      task = { id: t.id, params, orgId, status };
    }
    const href = opts.stepHref ? opts.stepHref(c.slug, step.slug) : `/learn/${encodeURIComponent(c.slug)}/${encodeURIComponent(step.slug)}`;
    return { courseSlug: c.slug, courseTitle: c.title, stepSlug: step.slug, stepTitle: step.title, href, doneRequired: o.doneRequired, totalRequired: o.totalRequired, task };
  }
  return null;
}

/**
 * Second segments of `/sites/<slug>/…` that are routes of their own, not a post
 * (apps/arts-collective/src/app/sites/[slug]/*). Anything else is `[contentSlug]`.
 */
const SITE_ROUTES = new Set(['center', 'classifieds', 'community', 'community-dark', 'offering', 'profile', 'workshop']);

/** `/sites/<org>/<post>` → its two slugs; null for any other path. */
export function postPathSlugs(path: string | null): { orgSlug: string; contentSlug: string } | null {
  if (!path) return null;
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '');
  const m = /^\/sites\/([^/]+)\/([^/]+)$/.exec(clean);
  if (!m) return null;
  let orgSlug: string, contentSlug: string;
  try {
    orgSlug = decodeURIComponent(m[1]).toLowerCase();
    contentSlug = decodeURIComponent(m[2]);
  } catch {
    return null;
  }
  if (SITE_ROUTES.has(contentSlug) || orgSlug.length > 100 || contentSlug.length > 200) return null;
  return { orgSlug, contentSlug };
}

/** The post entries for the post on this page, when the person may act on it there. */
export async function dockPost(opts: Pick<DockOptions, 'userId' | 'path' | 'links'>): Promise<DockPost | null> {
  const slugs = postPathSlugs(opts.path);
  if (!slugs) return null;
  const [org] = await db<Array<{ id: string }>>`SELECT id FROM organizations WHERE slug = ${slugs.orgSlug} LIMIT 1`;
  if (!org) return null;
  const [t] = await db<Array<{ id: string; title: string; status: string; visibility: string; pinned: boolean }>>`
    SELECT id, title, status, visibility, pinned FROM threads
    WHERE org_id = ${org.id} AND slug = ${slugs.contentSlug} AND kind = 'post' AND status IN ('draft', 'published')
    ORDER BY (status = 'published') DESC, updated_at DESC
    LIMIT 1
  `;
  if (!t) return null;
  if (!(await canManageOrgPeople(opts.userId, org.id))) return null;
  const ctx = { userId: opts.userId, links: opts.links, subjectId: t.id };
  if (t.status === 'draft') {
    const s = await actionStatus('thread-publish', ctx);
    return { id: t.id, title: t.title, status: t.status, detail: s.detail ?? null, actions: s.done ? [] : [{ id: 'thread-publish', label: 'Publish', busyLabel: 'Publishing…' }] };
  }
  const s = await actionStatus('thread-pin', ctx);
  const canLead = t.visibility === 'PUBLIC';
  const actions: DockPostAction[] = !canLead
    ? []
    : s.done
      ? [{ id: 'thread-pin', label: 'Stop leading the site', busyLabel: 'Saving…', input: { pinned: false } }]
      : [{ id: 'thread-pin', label: 'Lead the site', busyLabel: 'Saving…', input: { pinned: true } }];
  return { id: t.id, title: t.title, status: t.status, detail: s.detail ?? null, actions };
}

/** Everything the dock shows for one person on one path; null when there is nothing. */
export async function dockData(opts: DockOptions): Promise<DockData | null> {
  const [step, post] = await Promise.all([
    dockStep(opts).catch((err) => { console.error('[actions] dock step:', err); return null; }),
    dockPost(opts).catch((err) => { console.error('[actions] dock post:', err); return null; }),
  ]);
  if (!step && !post) return null;
  return { step, post, links: { artdirect: opts.links.artdirect, nextcloud: opts.links.nextcloud } };
}

/** Entries the dock may perform: course entries and the two post entries it offers. */
export function isDockAction(id: string): boolean {
  const m = actionMeta(id);
  if (!m) return false;
  return m.scope !== 'thread' || id === 'thread-publish' || id === 'thread-pin';
}
