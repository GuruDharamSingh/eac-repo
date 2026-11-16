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
import { presentAction } from '../present';
import { confirmView, isMoneyMeta, type ConfirmCard, type ConfirmMode } from '../confirm';
import { routeFor, type ActionRoute } from '../route';
import { REGISTRY_CONFIRM } from './registry-confirm';
import { readDockState, writeDockStep, dockMarkDone, type DockState } from './dock-state';
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
  /**
   * Optional (2026-11-16): record a task step's completion when its status says done (the lesson's
   * `settleTaskStep`). With it the dock ticks a step the person finished on a page that does not
   * go through the registry (a profile popup's Save) as soon as it re-reads.
   */
  settleTask?(
    viewer: { userId: string | null; roles: Record<string, string> },
    input: { courseId: string; stepSlug: string; status: () => Promise<ActionStatus> },
  ): Promise<{ completedNow: boolean; courseCompleted: boolean } | null>;
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
  /**
   * What the step asks of the dock (2026-11-16): `do` (run it here, after a confirm), `go` (take the
   * person to the control; money entries are always this), `check` (nothing to press), `read` (no task).
   */
  kind: 'do' | 'go' | 'check' | 'read';
  /** Present for a task step: the entry, its status, and the inputs of `presentAction`. */
  task: null | {
    id: string;
    label: string;
    params: Record<string, string> | null;
    orgId: string | null;
    status: ActionStatus;
    /** Where the control lives, for a `go` step that has an address. */
    route: ActionRoute | null;
    /** The confirm card for a `do` step, already resolved for who is looking (confirm.ts). */
    confirm: ConfirmCard | null;
  };
}

/** Set while "Take me there" has the person away from the trail (lms_dock_state). */
export interface DockAway {
  returnHref: string;
  stepTitle: string | null;
  /** The anchor to outline on arrival, when the stored step is still the current one. */
  anchor: string | null;
  /** True when the page's `?eac-step=` is this departure's ticket. */
  ticketOk: boolean;
}

/** A step the person has just finished, shown once. */
export interface DockDone {
  stepTitle: string;
  courseSlug: string;
  nextStepTitle: string | null;
  courseDone: boolean;
}

export interface DockPickerRow {
  courseSlug: string;
  title: string;
  enrolled: boolean;
  doneRequired: number;
  totalRequired: number;
  current: boolean;
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
  away: DockAway | null;
  done: DockDone | null;
  /** Only when asked for (`picker: true`). */
  picker: DockPickerRow[] | null;
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
  /** Course slugs tried after the person's stored trail, in order; then their other enrolments. Default: getting-started. */
  courses?: readonly string[];
  /** The person's stored dock state (lms_dock_state), read by `dockData`. */
  state?: DockState | null;
  /** Draft confirm wording shows only in `draft-visible` (a dev preview or a global admin). Default `live`. */
  confirmMode?: ConfirmMode;
  /** The page's `?eac-step=` ticket, to tell whether this is the departure's own arrival. */
  ticket?: string | null;
  /** Include the course picker. */
  picker?: boolean;
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

const hubOf = (links: ActionLinks) => links.hub;

async function orgSlugOf(orgId: string | null): Promise<string | null> {
  if (!orgId) return null;
  const [o] = await db<Array<{ slug: string }>>`SELECT slug FROM organizations WHERE id = ${orgId} LIMIT 1`;
  return o?.slug ?? null;
}

interface StepResult {
  step: DockStep | null;
  /** Steps this read ticked (the status said done), so the Done card can show them. */
  justDone: Array<{ courseSlug: string; stepSlug: string; stepTitle: string; courseDone: boolean }>;
}

/** The person's current step, or null (no enrolment, finished, or nothing open). */
export async function dockStep(opts: DockOptions): Promise<DockStep | null> {
  return (await dockStepRead(opts)).step;
}

async function dockStepRead(opts: DockOptions): Promise<StepResult> {
  const { userId, lms } = opts;
  const justDone: StepResult['justDone'] = [];
  // The stored trail first (the person's choice), then the defaults, then their other enrolments.
  const preferred = [...(opts.state?.courseSlug ? [opts.state.courseSlug] : []), ...(opts.courses ?? ['getting-started'])];
  const candidates: Array<{ slug: string; id: string; title: string }> = [];
  for (const slug of preferred) {
    if (candidates.some((c) => c.slug === slug)) continue;
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
    // A pass settles a step whose status says done and then reads the outline again (the next step
    // unlocks only after the tick); at most three, so a surprise cannot loop.
    for (let pass = 0; pass < 3; pass++) {
      const o = await lms.getLearnerOutline({ userId, roles: {} }, { courseId: c.id });
      if (!o) break;
      // The stored step first when it is still open, then the continue step, then the other open
      // steps in order. A routine step (task.repeat 'daily') is never recorded as completed, so the
      // LMS keeps offering it; once its status says done for today it gives way to the next step, and a
      // routine course with every step done today gives way to the next course (2026-11-07).
      const open = o.steps.filter((s) => s.slug !== o.continueStep?.slug && !isDone(s) && s.access.allowed);
      let order = (o.continueStep ? [o.continueStep, ...open] : open);
      const stored = opts.state?.courseSlug === c.slug ? order.find((s) => s.slug === opts.state?.stepSlug) : undefined;
      if (stored) order = [stored, ...order.filter((s) => s !== stored)];
      order = order.slice(0, STEP_WALK);
      let picked: { step: DockOutlineStep; task: NonNullable<DockStep['task']> | null; kind: DockStep['kind'] } | null = null;
      let ticked = false;
      for (const step of order) {
        const t = lms.stepTask(step);
        if (opts.routinesOnly && t?.repeat !== 'daily') continue;
        if (!t) {
          picked = { step, task: null, kind: 'read' };
          break;
        }
        const orgId = t.scope === 'org' ? await resolveActionOrg(userId, null) : null;
        const params = t.params && Object.keys(t.params).length ? t.params : null;
        const status = await actionStatus(t.id, { userId, orgId, links: opts.links, params });
        if (t.repeat === 'daily' && status.done) continue;
        // Done on the platform but not yet recorded: record it now (the lesson's own path), then move on.
        if (status.done && !t.repeat && lms.settleTask) {
          const r = await lms.settleTask({ userId, roles: {} }, { courseId: c.id, stepSlug: step.slug, status: async () => status }).catch(() => null);
          if (r?.completedNow) {
            justDone.push({ courseSlug: c.slug, stepSlug: step.slug, stepTitle: step.title, courseDone: r.courseCompleted });
            await dockMarkDone(userId, c.slug, step.slug, { keep: true });
            ticked = true;
            break;
          }
        }
        const meta = actionMeta(t.id);
        const present = presentAction({ id: t.id, status, orgId, links: opts.links, params });
        const money = meta ? isMoneyMeta(meta) : false;
        const kind: DockStep['kind'] = present.kind === 'run' || present.kind === 'form' ? (money || !meta?.runnable ? 'go' : 'do') : present.kind === 'none' ? 'check' : 'go';
        const route = kind === 'go' ? routeFor(t.id, { hub: hubOf(opts.links), orgSlug: await orgSlugOf(orgId), partial: Boolean(status.partial) }) : null;
        const confirm = kind === 'do' && meta ? confirmView({ ...meta, confirm: REGISTRY_CONFIRM[meta.id] ?? meta.confirm }, opts.confirmMode ?? 'live') : null;
        picked = { step, task: { id: t.id, label: meta?.label ?? t.id, params, orgId, status, route, confirm }, kind };
        break;
      }
      if (ticked) continue;
      if (!picked) break;
      const { step, task, kind } = picked;
      if (opts.state?.courseSlug !== c.slug || opts.state?.stepSlug !== step.slug) await writeDockStep(userId, c.slug, step.slug);
      const href = opts.stepHref ? opts.stepHref(c.slug, step.slug) : `/learn/${encodeURIComponent(c.slug)}/${encodeURIComponent(step.slug)}`;
      return { justDone, step: { courseSlug: c.slug, courseTitle: c.title, stepSlug: step.slug, stepTitle: step.title, href, doneRequired: o.doneRequired, totalRequired: o.totalRequired, kind, task } };
    }
  }
  return { step: null, justDone };
}

/** The courses the person can pick from: their enrolments, and the default course when they have not begun it. */
export async function dockPicker(opts: DockOptions): Promise<DockPickerRow[]> {
  const { userId, lms } = opts;
  const rows: DockPickerRow[] = [];
  const seen = new Set<string>();
  const stored = opts.state?.courseSlug ?? null;
  for (const e of (await lms.listMyEnrolments(userId)).slice(0, 8)) {
    if (e.status === 'withdrawn' || seen.has(e.courseSlug)) continue;
    seen.add(e.courseSlug);
    const c = await lms.getCourseBySlug(e.courseSlug);
    if (!c?.publishedVersionId) continue;
    const o = await lms.getLearnerOutline({ userId, roles: {} }, { courseId: c.id }).catch(() => null);
    rows.push({ courseSlug: c.slug, title: c.title, enrolled: true, doneRequired: o?.doneRequired ?? 0, totalRequired: o?.totalRequired ?? 0, current: false });
  }
  for (const slug of opts.courses ?? ['getting-started']) {
    if (seen.has(slug)) continue;
    const c = await lms.getCourseBySlug(slug);
    if (c?.publishedVersionId) rows.push({ courseSlug: c.slug, title: c.title, enrolled: false, doneRequired: 0, totalRequired: 0, current: false });
  }
  const current = rows.find((r) => r.courseSlug === stored)?.courseSlug ?? rows.find((r) => r.enrolled)?.courseSlug;
  return rows.map((r) => ({ ...r, current: r.courseSlug === current }));
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
  const state = opts.state === undefined ? await readDockState(opts.userId) : opts.state;
  const withState = { ...opts, state };
  const [read, post, channel, picker] = await Promise.all([
    dockStepRead(withState).catch((err): StepResult => { console.error('[actions] dock step:', err); return { step: null, justDone: [] }; }),
    dockPost(opts).catch((err) => { console.error('[actions] dock post:', err); return null; }),
    dockChannel(opts).catch((err) => { console.error('[actions] dock channel:', err); return null; }),
    opts.picker ? dockPicker(withState).catch(() => null) : Promise.resolve(null),
  ]);
  const step = read.step;
  const away: DockAway | null = state?.departedFrom
    ? { returnHref: state.departedFrom, stepTitle: step?.stepTitle ?? null, anchor: step?.task?.route?.anchor ?? null, ticketOk: Boolean(opts.ticket && state.ticket === opts.ticket) }
    : null;
  const done = await doneCard(withState, read, step).catch(() => null);
  if (!step && !post && !channel && !away && !done && !picker) return null;
  return { step, away, done, picker, post, channel, links: { artdirect: opts.links.artdirect, nextcloud: opts.links.nextcloud } };
}

/** The Done card: a step this read just ticked, or the one the completion hook ticked and nobody has seen. */
async function doneCard(opts: DockOptions, read: StepResult, step: DockStep | null): Promise<DockDone | null> {
  const next = (courseSlug: string) => (step && step.courseSlug === courseSlug ? step.stepTitle : null);
  const s = opts.state;
  const fresh = read.justDone[read.justDone.length - 1];
  if (!s?.donePending || !s.doneCourseSlug || !s.doneStepSlug) {
    return fresh ? { stepTitle: fresh.stepTitle, courseSlug: fresh.courseSlug, nextStepTitle: next(fresh.courseSlug), courseDone: fresh.courseDone || !step } : null;
  }
  const c = await opts.lms.getCourseBySlug(s.doneCourseSlug);
  if (!c) return null;
  const o = await opts.lms.getLearnerOutline({ userId: opts.userId, roles: {} }, { courseId: c.id });
  const title = o?.steps.find((x) => x.slug === s.doneStepSlug)?.title;
  if (!title) return null;
  return { stepTitle: title, courseSlug: c.slug, nextStepTitle: next(c.slug), courseDone: !step || (o?.doneRequired ?? 0) >= (o?.totalRequired ?? 1) };
}

/** Entries the dock may perform: course entries, the two post entries and the channel moves it offers. */
export function isDockAction(id: string): boolean {
  const m = actionMeta(id);
  if (!m) return false;
  // Hub card writes (appOnly) run only through the site-bound hub door, never the dock.
  if (m.appOnly) return false;
  // Money entries are route-only: the dock never runs them (DOCK_RAILS_PLAN §1, DOCK_LOOP_SLICE1 §0).
  if (isMoneyMeta(m)) return false;
  if (m.scope === 'channel') return CHANNEL_DOCK_ACTIONS.includes(id);
  return m.scope !== 'thread' || id === 'thread-publish' || id === 'thread-pin';
}
