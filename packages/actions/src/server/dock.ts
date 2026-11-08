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
import { CHANNEL_DOCK_ACTIONS, type ChannelNextMove } from '../channel';
import { actionStatus, type ActionSources } from './status';
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
  stepTask(step: DockOutlineStep): { id: string; scope?: 'person' | 'org'; params?: Record<string, string>; repeat?: 'daily' } | null;
}

/** How many open steps of one course the dock reads statuses for before giving up on it. */
const STEP_WALK = 12;

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

/**
 * The channel's top next move (2026-11-07): the same move, from the same reader, as
 * the first card of Channel Home's next row (`channel-next`). One move only: the
 * dock is the surface of the board, not a second board.
 */
export interface DockChannel {
  /** "Next for this piece" on a piece's board, else "On your board" (owner, 2026-11-07: "Board", after trying "Docket"). */
  label: string;
  move: ChannelNextMove;
  /** How many more moves are waiting (up to the reader's limit). */
  more: number;
  /** Channel Home on this host. */
  href: string;
}

export interface DockData {
  step: DockStep | null;
  post: DockPost | null;
  /** On Channel's inner pages and in the Studio, when the host passes `sources.channelNext`. */
  channel: DockChannel | null;
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
  /**
   * Show only routine steps (task.repeat 'daily', like the Akhand Path reading),
   * never the stages of a course (owner, 2026-11-07: the dock is the assistant's
   * light suggestion, not course onboarding). Default false.
   */
  routinesOnly?: boolean;
  /** Where a step lives; default `/learn/<course>/<step>`. */
  stepHref?: (courseSlug: string, stepSlug: string) => string;
  /** Host readers; `channelNext` gives the dock its Channel part (`channelDockPath` decides where). */
  sources?: ActionSources;
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
    // The continue step, then the other open steps in order. A routine step (task.repeat
    // 'daily') is never recorded as completed, so the LMS keeps offering it; once its
    // status says done for today it gives way to the next step, and a routine course
    // with every step done today gives way to the next course (2026-11-07). Courses
    // without routine steps take the first step, as before.
    const open = o.steps.filter((s) => s.slug !== o.continueStep?.slug && !isDone(s) && s.access.allowed);
    const order = (o.continueStep ? [o.continueStep, ...open] : open).slice(0, STEP_WALK);
    let picked: { step: DockOutlineStep; task: DockStep['task'] } | null = null;
    for (const step of order) {
      const t = lms.stepTask(step);
      if (opts.routinesOnly && t?.repeat !== 'daily') continue;
      if (!t) {
        picked = { step, task: null };
        break;
      }
      const orgId = t.scope === 'org' ? await resolveActionOrg(userId, null) : null;
      const params = t.params && Object.keys(t.params).length ? t.params : null;
      const status = await actionStatus(t.id, { userId, orgId, links: opts.links, params });
      if (t.repeat === 'daily' && status.done) continue;
      picked = { step, task: { id: t.id, params, orgId, status } };
      break;
    }
    if (!picked) continue;
    const { step, task } = picked;
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

/**
 * Where the dock carries the channel's next move (2026-11-07), and for which piece:
 *   /channel/piece/<thread|artwork>/<id>   that piece's first move, else the channel's
 *   /channel/<anything else>, /studio…     the channel's first move
 * Not on Channel Home (`/channel` itself), which shows the moves as its top row, and
 * nowhere else for now: reading the board runs the /channel loader, so it stays on
 * the pages where publishing is the work at hand.
 */
export function channelDockPath(path: string | null): { pieceKey: string | null } | null {
  if (!path) return null;
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (clean === '/channel') return null;
  const piece = /^\/channel\/piece\/(thread|artwork)\/([^/]+)$/.exec(clean);
  if (piece) {
    try {
      const id = decodeURIComponent(piece[2]);
      return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? { pieceKey: `${piece[1]}:${id}` } : { pieceKey: null };
    } catch {
      return { pieceKey: null };
    }
  }
  if (/^\/channel\//.test(clean) || clean === '/studio' || /^\/studio\//.test(clean)) return { pieceKey: null };
  return null;
}

/** The channel part of the dock: the person's own channel (it carries the orgs they run). */
export async function dockChannel(opts: Pick<DockOptions, 'userId' | 'path' | 'links' | 'sources'>): Promise<DockChannel | null> {
  const where = channelDockPath(opts.path);
  const read = opts.sources?.channelNext;
  if (!where || !read) return null;
  // On a piece's board, read further down the list so that piece's own move is found.
  const moves = await read({ userId: opts.userId, orgId: null, limit: where.pieceKey ? 20 : 5 });
  if (!moves.length) return null;
  const mine = where.pieceKey ? moves.find((m) => m.pieceKey === where.pieceKey) : undefined;
  const move = mine ?? moves[0];
  const more = where.pieceKey ? Math.min(moves.length, 5) - 1 : moves.length - 1;
  return { label: mine ? 'Next for this piece' : 'On your board', move, more: Math.max(0, more), href: `${opts.links.hub}/channel` };
}

/** Everything the dock shows for one person on one path; null when there is nothing. */
export async function dockData(opts: DockOptions): Promise<DockData | null> {
  const [step, post, channel] = await Promise.all([
    dockStep(opts).catch((err) => { console.error('[actions] dock step:', err); return null; }),
    dockPost(opts).catch((err) => { console.error('[actions] dock post:', err); return null; }),
    dockChannel(opts).catch((err) => { console.error('[actions] dock channel:', err); return null; }),
  ]);
  if (!step && !post && !channel) return null;
  return { step, post, channel, links: { artdirect: opts.links.artdirect, nextcloud: opts.links.nextcloud } };
}

/** Entries the dock may perform: course entries, the two post entries and the channel moves it offers. */
export function isDockAction(id: string): boolean {
  const m = actionMeta(id);
  if (!m) return false;
  if (m.scope === 'channel') return CHANNEL_DOCK_ACTIONS.includes(id);
  return m.scope !== 'thread' || id === 'thread-publish' || id === 'thread-pin';
}
