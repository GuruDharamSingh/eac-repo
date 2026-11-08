/**
 * Performing an entry: input schema, permission check, handler.
 *
 * `performAction` is what a host's one generic server action (`runAction`)
 * calls. The host resolves the actor from its verified session and passes it
 * in; nothing here reads an actor from the input, because `runAction` is a
 * single endpoint for every entry and a client-supplied actor would let any
 * entry run as anyone.
 *
 * Phase 1 (2026-11-06) holds the three entries a host already performed
 * through its own server actions (apps/*\/src/lib/cms/journey-actions.ts);
 * phase 2 added `org-email`, the first with an input form and an org
 * permission check; the registry pass the same day added `profile`,
 * `org-details` and `listing` (plain field edits through the services that
 * already write them) and `org-publish` (a draft post only). The others are performed by the surfaces they open and
 * move here one at a time (docs/open/LMS_ACTION_LAYER_BRIEF_2026-11-06.md §3.1).
 *
 * Text fields: absent means untouched, an empty string clears the value.
 */
// zod/v4 (shipped inside zod 3.25): its schemas convert to JSON Schema (`z.toJSONSchema`), which
// `actionInputSchema` callers use to describe an entry's input outside TypeScript.
import { z } from 'zod/v4';
import { db } from '@elkdonis/db';
import type { ActionResult } from '../types';
import { actionMeta } from '../catalogue';
import { CHANNEL_OUTLET_IDS } from '../channel';
import { acceptSuggestion, dismissSuggestion, fillSlot, planStep } from './channel';
import { HUB_RUNNERS } from './hub-runners';
import type { SiteBuilderAdapter } from './site-adapter';

export interface ActorContext {
  /** users.id of the signed-in person, from the host's verified session. */
  userId: string;
  email: string;
  /** The organisation an `org` entry acts on, resolved and checked by the host. */
  orgId?: string | null;
  /**
   * The org the caller asked for, before actionOrgId settled `orgId` (2026-11-07). Read
   * for `channel` entries only: a claim that did not settle into `orgId` is refused, so
   * a call meant for an org's channel never lands in the person's own.
   */
  orgClaim?: string | null;
  /** Which door performed it, for the audit row: 'app' (a host's server action, the default), 'http' (actionRoutes). */
  via?: string;
  /**
   * Set by a site-bound door (performHubAction, 2026-11-08): this host's org. An `org`
   * entry must act on it, a `thread` entry's post must belong to it, and `channel`
   * entries are refused (Channel is central). Absent = no site binding (as before).
   */
  siteOrgId?: string | null;
  /** The host's page adapter, passed by performHubAction for the Site Builder entries. */
  siteAdapter?: SiteBuilderAdapter;
  /** A `thread` entry's subject: the post's id, as the caller names it. performAction loads and checks it. */
  subjectId?: string | null;
  /** Set by performAction for a `thread` entry: the post, read from the database. Never from the caller. */
  thread?: ThreadSubject;
}

/** One post as a subject-scoped runner sees it. */
export interface ThreadSubject {
  id: string;
  orgId: string;
  authorId: string | null;
  title: string;
  status: string;
  visibility: string;
  pinned: boolean;
}

async function loadThread(id: string): Promise<ThreadSubject | null> {
  const [t] = await db<Array<{ id: string; org_id: string; author_id: string | null; title: string; status: string; visibility: string; pinned: boolean; kind: string }>>`
    SELECT id, org_id, author_id, title, status, visibility, pinned, kind FROM threads WHERE id = ${id.slice(0, 64)} LIMIT 1
  `;
  if (!t || t.kind !== 'post' || t.status === 'archived') return null;
  return { id: t.id, orgId: t.org_id, authorId: t.author_id, title: t.title, status: t.status, visibility: t.visibility, pinned: t.pinned };
}

/**
 * The host's own pages ('app'): where a person sees what changes. Publishing,
 * pinning and editing a published post are allowed only from there; other doors
 * (the HTTP routes, later agents) work on drafts. Policy for those doors, not a
 * boundary against the person: they can do the same in the console.
 */
const hostDoor = (ctx: ActorContext) => (ctx.via ?? 'app') === 'app';

type Allowed = { ok: true } | { ok: false; error: string };

export interface Runner<I> {
  /** Absent: the entry takes no input and ignores what it is given. */
  input?: z.ZodType<I>;
  /** Beyond "signed in", which performAction checks for every entry. */
  allowed?: (ctx: ActorContext, input: I) => Promise<Allowed>;
  run: (ctx: ActorContext, input: I) => Promise<ActionResult>;
  /** Said to the person when the handler throws. */
  failure: string;
}

const runner = <I>(r: Runner<I>): Runner<unknown> => r as Runner<unknown>;

/** The post's author, or an owner or guide of the post's org. */
async function threadEditor(ctx: ActorContext): Promise<Allowed> {
  if (ctx.thread?.authorId && ctx.thread.authorId === ctx.userId) return { ok: true };
  return orgEditor(ctx);
}

/** Owners and guides of the org the host resolved — the email suite's and org-people's rule. */
async function orgEditor(ctx: ActorContext): Promise<Allowed> {
  if (!ctx.orgId) return { ok: false, error: 'Start an organisation first.' };
  const { canManageOrgPeople } = await import('@elkdonis/services');
  return (await canManageOrgPeople(ctx.userId, ctx.orgId)) ? { ok: true } : { ok: false, error: 'Only the organisation’s owners and guides can change this.' };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A Channel piece key (`thread:<id>` / `artwork:<id>`; ./channel.ts parses it) and an identity (`user:<uuid>` / `org:<id>`). */
const CH_PIECE = z.string().trim().max(90);
const CH_IDENTITY = z.string().trim().max(80).nullable().optional();

/** An optional text field: absent stays absent, '' becomes null (cleared). */
const cleared = (v: string | undefined): string | null | undefined => (v === undefined ? undefined : v || null);
const anyOf = (...keys: string[]) => (v: Record<string, unknown>) => keys.some((k) => v[k] !== undefined);

export const RUNNERS: Record<string, Runner<unknown>> = {
  // Your profile: name, line and bio (services' updateProfile, with the caps of
  // /api/center/profile). The photo stays with the profile surface, which uploads it.
  profile: runner({
    input: z
      .object({
        displayName: z.string().trim().max(120).optional(),
        headline: z.string().trim().max(200).optional(),
        bio: z.string().trim().max(4000).optional(),
      })
      .refine(anyOf('displayName', 'headline', 'bio'), 'Nothing to save.')
      .refine((v) => v.displayName === undefined || v.displayName.length > 0, 'A name is required.'),
    failure: 'Could not save your profile. Try again.',
    async run(ctx, input) {
      const { updateProfile } = await import('@elkdonis/services');
      await updateProfile(ctx.userId, { displayName: input.displayName, headline: cleared(input.headline), bio: cleared(input.bio) });
      return { ok: true };
    },
  }),

  // Your page in the directory: the same switch as the presence grid's "Network
  // directory" cell (services' setPresence, which refuses a status-only cell).
  listing: runner({
    input: z.object({ listed: z.boolean() }),
    failure: 'Could not change the listing. Try again.',
    async run(ctx, input) {
      if (input.listed) {
        const [u] = await db<Array<{ slug: string | null }>>`SELECT slug FROM users WHERE id = ${ctx.userId} LIMIT 1`;
        if (!u?.slug) return { ok: false, error: 'Your page has no address yet. Take your space first.' };
      }
      const { setPresence } = await import('@elkdonis/services');
      const r = await setPresence(ctx.userId, { row: 'you', column: 'directory', on: input.listed });
      return r.ok === true ? { ok: true } : { ok: false, error: r.error };
    },
  }),

  // Organisation details: its line and description, on the org's identity row
  // (organizations.profile_user_id), as saveOrgIdentityAction writes them. Owners
  // and guides only: unlike that action, no network-admin bypass. Name and image
  // stay with the console (a rename also writes organizations.name; the image is an upload).
  'org-details': runner({
    input: z
      .object({
        headline: z.string().trim().max(200).optional(),
        bio: z.string().trim().max(4000).optional(),
      })
      .refine(anyOf('headline', 'bio'), 'Nothing to save.'),
    allowed: (ctx) => orgEditor(ctx),
    failure: 'Could not save the organisation’s details. Try again.',
    async run(ctx, input) {
      const [org] = await db<Array<{ profile_user_id: string | null }>>`SELECT profile_user_id FROM organizations WHERE id = ${ctx.orgId!} LIMIT 1`;
      if (!org?.profile_user_id) return { ok: false, error: 'This organisation has no identity record yet.' };
      const { updateProfile } = await import('@elkdonis/services');
      await updateProfile(org.profile_user_id, { headline: cleared(input.headline), bio: cleared(input.bio) });
      return { ok: true };
    },
  }),

  // Take your space: folder, oad membership, directory listing (services' gainSpace, as /wizard calls on open).
  'gain-space': runner({
    failure: 'Could not set that up. Try again.',
    async run(ctx) {
      const { gainSpace } = await import('@elkdonis/services');
      await gainSpace(ctx.userId);
      return { ok: true };
    },
  }),

  // Open a store on the market (commerce's auction journey, step 2).
  store: runner({
    failure: 'Could not open the store. Try again.',
    async run(ctx) {
      const { publishStoreForAuction } = await import('@elkdonis/commerce/server');
      const [u] = await db<Array<{ display_name: string | null }>>`SELECT display_name FROM users WHERE id = ${ctx.userId}`;
      const r = await publishStoreForAuction({ userId: ctx.userId, email: ctx.email, displayName: u?.display_name ?? ctx.email.split('@')[0] });
      return r.ok === false ? { ok: false, error: r.error } : { ok: true, data: { state: r.state } };
    },
  }),

  // Start an organisation: name and address (services' createOrganizationForUser validates both).
  org: runner({
    input: z.object({ title: z.string().max(200), subdomain: z.string().max(100) }),
    failure: 'Could not create the organisation. Try again.',
    async run(ctx, input) {
      const { createOrganizationForUser } = await import('@elkdonis/services');
      const r = await createOrganizationForUser({ userId: ctx.userId, title: input.title, subdomain: input.subdomain });
      return r.ok === true ? { ok: true, data: { slug: r.slug } } : { ok: false, error: r.error };
    },
  }),

  // A draft post on the org site (services' createThread, the shared thread write path:
  // free slug, sanitised body, no published_at for a draft). Draft only, as the OpenClaw
  // bridge does: publishing, events and meetings stay with the composer, where a person
  // sees the page. Plain text in; blank lines make paragraphs (textToHtml, as Post anywhere).
  // The author is the person; signing as the org (resolveActor) stays with the composer.
  'org-publish': runner({
    input: z.object({
      title: z.string().trim().max(200).refine((v) => v.length >= 2, 'Give it a title of at least two characters.'),
      text: z.string().max(20000).optional(),
    }),
    allowed: (ctx) => orgEditor(ctx),
    failure: 'Could not save the draft. Try again.',
    async run(ctx, input) {
      const { createThread, textToHtml } = await import('@elkdonis/services');
      const text = input.text?.trim();
      const post = await createThread({
        kind: 'post',
        orgId: ctx.orgId!,
        authorId: ctx.userId,
        title: input.title,
        body: text ? textToHtml(text) : undefined,
        status: 'draft',
      });
      return { ok: true, data: { threadId: post.id, slug: post.slug, status: 'draft' } };
    },
  }),

  // Edit one post: title and/or text (services' updatePost: kind 'post' only, filtered by
  // org, body sanitised, excerpt re-derived). `text` is plain (textToHtml); `html` is
  // sanitised by updatePost. A published post only from the host's own pages.
  'thread-edit': runner({
    input: z
      .object({
        title: z.string().trim().max(200).refine((v) => v.length >= 2, 'Give it a title of at least two characters.').optional(),
        text: z.string().max(20000).optional(),
        html: z.string().max(60000).optional(),
      })
      .refine(anyOf('title', 'text', 'html'), 'Nothing to save.')
      .refine((v) => v.text === undefined || v.html === undefined, 'Send text or html, not both.'),
    async allowed(ctx) {
      if (ctx.thread!.status === 'published' && !hostDoor(ctx)) return { ok: false, error: 'A published post is edited from the site itself.' };
      return threadEditor(ctx);
    },
    failure: 'Could not save the post. Try again.',
    async run(ctx, input) {
      const t = ctx.thread!;
      const { updatePost, textToHtml } = await import('@elkdonis/services');
      const body = input.html !== undefined ? input.html : input.text !== undefined ? (input.text.trim() ? textToHtml(input.text) : '') : undefined;
      const post = await updatePost(t.id, t.orgId, { title: input.title, body });
      return { ok: true, data: { threadId: post.id, slug: post.slug, status: t.status } };
    },
  }),

  // Publish a draft post (updatePost with status 'published', which stamps published_at
  // once). Owners and guides; only from the host's own pages, where a person presses it.
  'thread-publish': runner({
    async allowed(ctx) {
      if (!hostDoor(ctx)) return { ok: false, error: 'Publish from the site itself, where you can see the post.' };
      return orgEditor(ctx);
    },
    failure: 'Could not publish the post. Try again.',
    async run(ctx) {
      const t = ctx.thread!;
      if (t.status === 'published') return { ok: true, data: { threadId: t.id, status: 'published', already: true } };
      if (t.status !== 'draft') return { ok: false, error: 'Only a draft can be published here.' };
      const { updatePost } = await import('@elkdonis/services');
      const post = await updatePost(t.id, t.orgId, { status: 'published' });
      return { ok: true, data: { threadId: post.id, slug: post.slug, status: 'published' } };
    },
  }),

  // Pin or unpin: what leads the org's site. The console's rule (togglePinAction,
  // apps/arts-collective/src/lib/cms/actions.ts): one pinned post per org, and only a
  // published PUBLIC post can lead. Owners and guides; only from the host's own pages.
  'thread-pin': runner({
    input: z.object({ pinned: z.boolean() }),
    async allowed(ctx) {
      if (!hostDoor(ctx)) return { ok: false, error: 'Change what leads the site from the site itself.' };
      return orgEditor(ctx);
    },
    failure: 'Could not change what leads the site. Try again.',
    async run(ctx, input) {
      const t = ctx.thread!;
      if (input.pinned && !(t.status === 'published' && t.visibility === 'PUBLIC')) {
        return { ok: false, error: 'Only a published public post can lead the site.' };
      }
      await db.begin(async (tx) => {
        if (input.pinned) await tx`UPDATE threads SET pinned = false WHERE org_id = ${t.orgId} AND pinned = true AND id <> ${t.id}`;
        await tx`UPDATE threads SET pinned = ${input.pinned} WHERE id = ${t.id} AND org_id = ${t.orgId}`;
      });
      return { ok: true, data: { threadId: t.id, pinned: input.pinned } };
    },
  }),

  // The org's sending name and reply-to (the email suite's Look tab, two fields of it).
  // fromEmail stays out on purpose, as in /api/org/[slug]/email/identity: it must be an
  // authenticated domain. An empty field clears the value (saveOrgEmailIdentity).
  'org-email': runner({
    input: z.object({
      fromName: z.string().trim().max(100),
      replyTo: z.string().trim().max(200).refine((v) => v === '' || EMAIL_RE.test(v), 'That is not an email address.'),
    }),
    allowed: (ctx) => orgEditor(ctx),
    failure: 'Could not save the mail settings. Try again.',
    async run(ctx, input) {
      const [row] = await db<Array<{ inbound: boolean | null }>>`
        SELECT (value->>'inboundReplies')::boolean AS inbound FROM site_config WHERE org_id = ${ctx.orgId!} AND key = 'email:identity' LIMIT 1
      `;
      // When replies come into the org's inbox, the reply-to is that inbox; the
      // suite's toggle owns it, so this form leaves it alone.
      const save: Record<string, unknown> = { fromName: input.fromName };
      if (!row?.inbound) save.replyTo = input.replyTo;
      const { saveOrgEmailIdentity } = await import('@elkdonis/email');
      const r = await saveOrgEmailIdentity(ctx.orgId!, save);
      return r.ok ? { ok: true, data: { replyToKept: Boolean(row?.inbound) } } : { ok: false, error: r.error ?? 'Could not save the mail settings.' };
    },
  }),

  // Channel (scope 'channel', 2026-11-07): the board's moves. Authorization, the door
  // policy and the actor kind are in ./channel.ts (the rules of the app's
  // lib/channel/actions.ts). Plans only: nothing here schedules or sends.
  'channel-suggestion-accept': runner({
    input: z.object({
      pieceKey: CH_PIECE,
      outlet: z.enum(CHANNEL_OUTLET_IDS),
      identityId: CH_IDENTITY,
      text: z.string().trim().max(200).refine((v) => v.length > 0, 'Say what the post is.'),
      at: z.string().trim().max(40).nullable().optional(),
      routineId: z.string().trim().max(21).nullable().optional(),
    }),
    failure: 'Could not add it to the queue. Try again.',
    run: (ctx, input) => acceptSuggestion(ctx, input),
  }),

  'channel-suggestion-dismiss': runner({
    input: z.object({
      pieceKey: CH_PIECE,
      outlet: z.enum(CHANNEL_OUTLET_IDS),
      identityId: CH_IDENTITY,
      text: z.string().max(200).optional(),
    }),
    failure: 'Could not dismiss it. Try again.',
    run: (ctx, input) => dismissSuggestion(ctx, input),
  }),

  'channel-slot-fill': runner({
    input: z.object({
      routineId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,21}$/),
      at: z.string().trim().max(40),
      pieceKey: CH_PIECE,
      text: z.string().max(200).optional(),
    }),
    failure: 'Could not fill the slot. Try again.',
    run: (ctx, input) => fillSlot(ctx, input),
  }),

  'channel-plan-step': runner({
    input: z
      .object({
        pieceKey: CH_PIECE,
        identityId: CH_IDENTITY,
        op: z.enum(['add', 'check', 'uncheck']),
        text: z.string().trim().max(300).refine((v) => v.length > 0, 'Give the step its text.'),
        index: z.number().int().min(0).max(500).optional(),
        on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      })
      .refine((v) => v.op === 'add' || v.index !== undefined, 'Name the step to tick by its index.'),
    failure: 'Could not change the plan. Try again.',
    run: (ctx, input) => planStep(ctx, input),
  }),

  // Hub card entries (2026-11-08): ./hub-runners.ts, all appOnly.
  ...HUB_RUNNERS,
};

/** The ids that have a runner: the entries a host, a route or a script can perform directly. */
export const RUNNABLE_IDS: readonly string[] = Object.keys(RUNNERS);

/** An entry's input schema; null when the entry takes no input or has no runner. */
export function actionInputSchema(id: string): z.ZodType | null {
  return RUNNERS[id]?.input ?? null;
}

/** Perform one entry for the signed-in actor. Never throws. Every call with an actor leaves an `action_events` row. */
export async function performAction(id: string, ctx: ActorContext, raw: unknown): Promise<ActionResult> {
  if (!ctx?.userId) return { ok: false, error: 'Sign in first.', code: 'auth' };
  const started = Date.now();
  const { input, result, ctx: used } = await perform(id, ctx, raw);
  await record(id, used, input, result, Date.now() - started);
  return result;
}

async function perform(id: string, given: ActorContext, raw: unknown): Promise<{ input: unknown; result: ActionResult; ctx: ActorContext }> {
  // subjectId means something only for a subject-scoped entry; elsewhere it is dropped (and never audited).
  let ctx: ActorContext = { ...given, thread: undefined, subjectId: actionMeta(id)?.scope === 'thread' ? given.subjectId : null };
  const r = RUNNERS[id];
  if (!r) return { ctx, input: raw, result: { ok: false, error: 'This cannot be done from here.', code: 'unknown' } };
  const meta = actionMeta(id);
  // appOnly entries (hub card writes) run only through the site-bound hub door:
  // a host's own pages (via 'app') AND a site binding, which only performHubAction
  // sets. A generic runAction endpoint or the dock (via 'app', no siteOrgId) is refused.
  if (meta?.appOnly && (!hostDoor(given) || !given.siteOrgId)) {
    return { ctx, input: raw, result: { ok: false, error: 'This is done from the site’s own pages.', code: 'forbidden' } };
  }
  // A site-bound door (siteOrgId): org entries act on the site's org only; no channel entries.
  if (given.siteOrgId) {
    if (meta?.scope === 'channel') return { ctx, input: raw, result: { ok: false, error: 'This cannot be done from here.', code: 'forbidden' } };
    if (meta?.scope === 'org' && ctx.orgId !== given.siteOrgId) {
      return { ctx, input: raw, result: { ok: false, error: 'That organisation isn’t this site’s.', code: 'forbidden' } };
    }
  }
  // A `channel` entry asked for an org channel the door did not settle (not an owner or guide there, or `oad`): refuse.
  if (actionMeta(id)?.scope === 'channel' && typeof given.orgClaim === 'string' && given.orgClaim.trim() && !ctx.orgId) {
    return { ctx, input: raw, result: { ok: false, error: 'You do not run that organisation’s channel.', code: 'forbidden' } };
  }
  // A `thread` entry acts on one post: load it, and take its org from the row, never from a claim.
  if (actionMeta(id)?.scope === 'thread') {
    ctx = { ...ctx, orgId: null }; // a claimed org never applies (nor reaches the audit row) for a post entry
    const subjectId = typeof ctx.subjectId === 'string' ? ctx.subjectId.trim() : '';
    if (!subjectId) return { ctx, input: raw, result: { ok: false, error: 'Name the post this acts on.', code: 'input' } };
    const thread = await loadThread(subjectId);
    if (!thread) return { ctx, input: raw, result: { ok: false, error: 'No such post.', code: 'unknown' } };
    if (given.siteOrgId && thread.orgId !== given.siteOrgId) {
      return { ctx, input: raw, result: { ok: false, error: 'That post isn’t on this site.', code: 'forbidden' } };
    }
    ctx = { ...ctx, orgId: thread.orgId, thread };
  }
  const res = await performChecked(id, r, ctx, raw);
  return { ...res, ctx };
}

async function performChecked(id: string, r: Runner<unknown>, ctx: ActorContext, raw: unknown): Promise<{ input: unknown; result: ActionResult }> {
  let input: unknown = undefined;
  if (r.input) {
    const parsed = r.input.safeParse(raw);
    if (parsed.success === false) return { input: raw, result: { ok: false, error: inputError(parsed.error.issues), code: 'input' } };
    input = parsed.data;
  }
  try {
    if (r.allowed) {
      const a = await r.allowed(ctx, input);
      if (a.ok === false) return { input, result: { ok: false, error: a.error, code: 'forbidden' } };
    }
    return { input, result: await r.run(ctx, input) };
  } catch (err) {
    console.error('[actions] run:', id, ctx.thread ? `thread ${ctx.thread.id}` : '', err);
    return { input, result: { ok: false, error: r.failure, code: 'failed' } };
  }
}

/**
 * What to say about input that failed its schema. A refine's own words are for
 * the person, but only when every issue is a refine: zod/v4 runs an object's
 * refines even after a field fails, so "Nothing to save." can sit next to the
 * real problem. A too-long string is named; other zod defaults are not shown.
 */
function inputError(issues: ReadonlyArray<{ code: string; message: string; path: ReadonlyArray<PropertyKey>; origin?: string; maximum?: unknown }>): string {
  const field = issues.find((i) => i.code !== 'custom');
  if (!field) return issues[0]?.message ?? 'That request was not complete.';
  if (field.code === 'too_big' && field.origin === 'string' && field.path.length) {
    return `The ${field.path.map(String).join('.')} field is longer than ${String(field.maximum)} characters.`;
  }
  return 'That request was not complete.';
}

/** Largest input kept on an audit row, as JSON text; a refused call's input comes from the caller. */
const AUDIT_INPUT_MAX = 4000;
/** When the table was last found missing; inserts pause for ten minutes, then try again. */
let auditMissingAt = 0;
/** Set once the subject_id column (migration 246) is found missing in this process. */
let subjectColumnMissing = false;
const AUDIT_RETRY_MS = 10 * 60 * 1000;

/**
 * `action_events.actor_type` (migration 245; CHECK 'human' | 'ai' | 'system'), from the
 * door (2026-11-07): the host's own pages are the person ('human'); a script is 'system';
 * every other door counts as an agent ('ai'), the same split Channel records as
 * `actor_kind` 'user' / 'agent'. Until 2026-11-07 the column was left to its default 'human'.
 */
function actorType(via: string | undefined): 'human' | 'ai' | 'system' {
  const door = via ?? 'app';
  return door === 'app' ? 'human' : door === 'script' ? 'system' : 'ai';
}

/**
 * The audit row (migration 245). Best effort: a failed insert is logged and the
 * person's result stands, because the action has already happened by now.
 */
async function record(id: string, ctx: ActorContext, input: unknown, result: ActionResult, ms: number): Promise<void> {
  if (auditMissingAt && Date.now() - auditMissingAt < AUDIT_RETRY_MS) return;
  let kept: unknown = input ?? null;
  try {
    if (kept !== null && JSON.stringify(kept).length > AUDIT_INPUT_MAX) kept = { omitted: `larger than ${AUDIT_INPUT_MAX} characters` };
  } catch {
    kept = { omitted: 'not JSON' };
  }
  const data = result.ok === true && result.data !== undefined ? result.data : null;
  // subject_id is migration 246; until it is applied the column is left out (and the subject is in the log line only).
  const subject = typeof ctx.subjectId === 'string' && ctx.subjectId && !subjectColumnMissing ? ctx.subjectId.slice(0, 64) : null;
  try {
    await db`
      INSERT INTO action_events (action_id, actor_id, actor_type, org_id, via, input, ok, error, code, result, duration_ms${subject ? db`, subject_id` : db``})
      VALUES (
        ${id.slice(0, 60)}, ${ctx.userId}, ${actorType(ctx.via)}, ${ctx.orgId ?? null}, ${(ctx.via ?? 'app').slice(0, 20)},
        ${kept === null ? null : db.json(kept as never)}, ${result.ok}, ${result.ok === false ? result.error : null}, ${result.ok === false ? result.code ?? null : null},
        ${data === null ? null : db.json(data as never)}, ${ms}${subject ? db`, ${subject}` : db``}
      )
    `;
  } catch (err) {
    // 42703: subject_id is not there yet (migration 246 unapplied). Write the row without it.
    if ((err as { code?: string })?.code === '42703' && subject) {
      subjectColumnMissing = true;
      console.warn('[actions] action_events.subject_id is missing (migration 246 not applied); subject', subject, 'not recorded.');
      return record(id, ctx, input, result, ms);
    }
    // 42P01: the table is not there yet (migration 245 unapplied). Warn on the first miss only.
    if ((err as { code?: string })?.code === '42P01') {
      if (!auditMissingAt) console.warn('[actions] action_events is missing (migration 245 not applied); calls are not being recorded.');
      auditMissingAt = Date.now();
      return;
    }
    console.error('[actions] audit row:', id, err);
  }
}
