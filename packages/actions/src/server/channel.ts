/**
 * Channel's authorization and its registry runners (2026-11-07).
 *
 * The helpers are the rules of apps/arts-collective/src/lib/channel/actions.ts
 * (review pass 2, docs/open/channel.md §1 "Who may write what"), moved here so
 * the registry and the Channel pages can share one copy:
 *   channelActing      who is acting: the person, the orgs they run (owner or
 *                      guide, never `oad`), the identities they control
 *   channelOwnerFor    `user:<uuid>` / `org:<id>` or the scope org → an owner
 *                      this person may act for
 *   channelIdentityOf  the name a row goes out under: the owner's own, never
 *                      a value from the input
 *   channelOwnRoutine  a routine id kept only if it is the owner's live routine
 *   channelPiece       the piece is the person's or an org's they run; `plan`
 *                      also admits artwork an org's site shows (shop:store pin),
 *                      `deliver` does not; archived pieces are refused
 * Until actions.ts imports them, the two copies must be changed together.
 *
 * Doors: every runner writes plans only (draft deliveries, plan steps, a
 * dismissed gap); nothing here schedules or sends. Dismissing is refused from
 * any door but the host's own pages. The actor kind written to Channel's rows
 * is 'user' from the host's pages and 'agent' from every other door, with the
 * door as the agent id until agents carry their own (`door:http`).
 */
import { db } from '@elkdonis/db';
import { getIdentityIds, listUserMemberships } from '@elkdonis/services';
import {
  ChannelNotReady,
  ChannelPlanConflict,
  addChannelPlanStep,
  channelRoutineOwnedBy,
  createChannelDelivery,
  findOpenChannelDelivery,
  listChannelDeliveries,
  listChannelRoutines,
  routineSlots,
  setChannelPlanStep,
  zonedDate,
  type ChannelActor,
  type ChannelOwner,
  type ChannelSubject,
} from '@elkdonis/services/channel';
import type { ActionResult } from '../types';
import type { ChannelOutletId } from '../channel';

/** The wall clock routines are read in: the loader's (apps/arts-collective/src/lib/channel/load.ts). */
const TIME_ZONE = process.env.CHANNEL_TIME_ZONE ?? 'America/Toronto';
const MANAGER = new Set(['owner', 'guide']);
const PERSONAL_ORG = 'oad';

export interface ChannelActing {
  userId: string;
  /** Orgs the person runs (owner or guide), `oad` excluded. */
  orgIds: string[];
  identityIds: string[];
}

export async function channelActing(userId: string): Promise<ChannelActing> {
  const [memberships, identityIds] = await Promise.all([listUserMemberships(userId), getIdentityIds(userId)]);
  return {
    userId,
    // "oad" is the personal org every "Just me" row lives under: a role on it
    // must not count as managing other people's personal posts.
    orgIds: memberships.filter((m) => MANAGER.has(m.role) && m.orgId !== PERSONAL_ORG).map((m) => m.orgId),
    identityIds,
  };
}

/** `user:<uuid>` or `org:<id>` → an owner this person may act for. With a scope org, only that org. */
export function channelOwnerFor(a: ChannelActing, identityId: string | null | undefined, scopeOrg: string | null): ChannelOwner | null {
  if (scopeOrg) return a.orgIds.includes(scopeOrg) ? { kind: 'org', id: scopeOrg } : null;
  if (!identityId || identityId === `user:${a.userId}`) return { kind: 'user', id: a.userId };
  const m = /^org:(.+)$/.exec(identityId);
  if (m && a.orgIds.includes(m[1])) return { kind: 'org', id: m[1] };
  return null;
}

/** The name a row goes out under is the owner's own: never taken from the input. */
export function channelIdentityOf(a: Pick<ChannelActing, 'userId'>, owner: ChannelOwner): string {
  return owner.kind === 'org' ? `org:${owner.id}` : `user:${a.userId}`;
}

/** A routine id from the input, kept only if it is this owner's live routine. */
export async function channelOwnRoutine(owner: ChannelOwner, routineId: string | null | undefined): Promise<string | null> {
  if (!routineId || !/^[A-Za-z0-9_-]{1,21}$/.test(routineId)) return null;
  return (await channelRoutineOwnedBy(owner, routineId)) ? routineId : null;
}

/** `thread:<id>` / `artwork:<id>` → the subject; null for anything else. */
export function parseChannelPieceKey(key: string | null | undefined): ChannelSubject | null {
  const m = /^(thread|artwork):([A-Za-z0-9_-]{1,64})$/.exec(key ?? '');
  return m ? { kind: m[1] as ChannelSubject['kind'], id: m[2] } : null;
}

/**
 * The piece, when the person may plan for it (`plan`) or send it out under a
 * name (`deliver`): its title, else null. Same rule as actions.ts `mayTouch`.
 */
export async function channelPiece(a: ChannelActing, subject: ChannelSubject, purpose: 'plan' | 'deliver' = 'deliver'): Promise<{ title: string } | null> {
  const orgs = a.orgIds.length ? a.orgIds : [''];
  if (subject.kind === 'thread') {
    const rows = await db<Array<{ title: string | null }>>`
      SELECT title FROM threads
      WHERE id = ${subject.id} AND status <> 'archived'
        AND (author_id = ANY(${a.identityIds}) OR org_id = ANY(${orgs}))
      LIMIT 1
    `;
    return rows[0] ? { title: rows[0].title || 'Untitled' } : null;
  }
  const rows = await db<Array<{ title: string | null }>>`
    SELECT a.title FROM artwork a
    LEFT JOIN store s ON s.id = a.store_id
    LEFT JOIN site_config c ON c.key = 'shop:store' AND c.value->>'storeId' = s.id::text
    WHERE a.id::text = ${subject.id} AND a.status <> 'archived'
      AND (a.artist_user_id = ${a.userId} OR a.credited_artist_user_id = ${a.userId}
           OR s.owner_user_id = ${a.userId}
           OR s.owner_org_id = ANY(${orgs})
           OR (${purpose === 'plan'} AND c.org_id = ANY(${orgs})))
    LIMIT 1
  `;
  return rows[0] ? { title: rows[0].title || 'Untitled' } : null;
}

// ── runners ─────────────────────────────────────────────────────────────────

/** What the runners need from performAction's ActorContext (kept structural: run.ts imports this file). */
export interface ChannelCallContext {
  userId: string;
  /** The org channel, settled by actionOrgId (resolveChannelOrg); null = the person's own channel. */
  orgId?: string | null;
  via?: string;
}

/** Actor kind 'user' from the host's own pages, 'agent' from any other door (CHANNEL brief, owner direction). */
export function channelActor(ctx: ChannelCallContext): ChannelActor {
  const via = ctx.via ?? 'app';
  return via === 'app' ? { kind: 'user', id: ctx.userId, userId: ctx.userId } : { kind: 'agent', id: `door:${via}`.slice(0, 60), userId: ctx.userId };
}

const forbidden = (error: string): ActionResult => ({ ok: false, error, code: 'forbidden' });

/** Channel's own refusals (tables missing, a stale plan) are the entry's: their words, no code. */
async function guarded(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ChannelNotReady || err instanceof ChannelPlanConflict) return { ok: false, error: err.message };
    throw err;
  }
}

interface Target {
  a: ChannelActing;
  owner: ChannelOwner;
  subject: ChannelSubject;
  title: string;
}

async function target(ctx: ChannelCallContext, pieceKey: string, identityId: string | null | undefined, purpose: 'plan' | 'deliver'): Promise<{ ok: true; t: Target } | { ok: false; r: ActionResult }> {
  const subject = parseChannelPieceKey(pieceKey);
  if (!subject) return { ok: false, r: { ok: false, error: 'Name the piece as thread:<id> or artwork:<id>.', code: 'input' } };
  const a = await channelActing(ctx.userId);
  const owner = channelOwnerFor(a, identityId, ctx.orgId ?? null);
  if (!owner) return { ok: false, r: forbidden('That channel is not yours.') };
  const piece = await channelPiece(a, subject, purpose);
  if (!piece) return { ok: false, r: forbidden('That piece is not yours.') };
  return { ok: true, t: { a, owner, subject, title: piece.title } };
}

const isoOrNull = (v: string | null | undefined): string | null => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

export interface SuggestionInput {
  pieceKey: string;
  outlet: ChannelOutletId;
  identityId?: string | null;
  text: string;
  at?: string | null;
  routineId?: string | null;
}

/** Accept: a draft delivery placed where the suggestion was, and a board step in plan.md (actions.ts acceptSuggestionsAction, one item). */
export function acceptSuggestion(ctx: ChannelCallContext, input: SuggestionInput): Promise<ActionResult> {
  return guarded(async () => {
    const got = await target(ctx, input.pieceKey, input.identityId, 'deliver');
    if (got.ok === false) return got.r;
    const { a, owner, subject } = got.t;
    const identityId = channelIdentityOf(a, owner);
    const open = await findOpenChannelDelivery(owner, subject, input.outlet, identityId);
    if (open) return { ok: true, data: { already: true, deliveryId: open.id, status: open.status } };
    const actor = channelActor(ctx);
    const at = isoOrNull(input.at);
    const text = input.text.slice(0, 200);
    const d = await createChannelDelivery(
      owner,
      { subject, outlet: input.outlet, status: 'draft', identityId, scheduledAt: at, routineId: await channelOwnRoutine(owner, input.routineId), payload: { suggestion: text, title: text } },
      actor,
    );
    const plan = await addChannelPlanStep(owner, subject, { text, fromBoard: true, on: at ? at.slice(0, 10) : null }, actor);
    return { ok: true, data: { deliveryId: d.id, planId: plan.id, status: 'draft', scheduledAt: at } };
  });
}

/** Dismiss: remembered as a 'dismissed' delivery so the gap stops suggesting it (actions.ts dismissSuggestionAction). */
export function dismissSuggestion(ctx: ChannelCallContext, input: Omit<SuggestionInput, 'at' | 'routineId' | 'text'> & { text?: string }): Promise<ActionResult> {
  return guarded(async () => {
    if ((ctx.via ?? 'app') !== 'app') return forbidden('Dismiss from Channel itself, where you can see what goes.');
    const got = await target(ctx, input.pieceKey, input.identityId, 'deliver');
    if (got.ok === false) return got.r;
    const { a, owner, subject } = got.t;
    const identityId = channelIdentityOf(a, owner);
    const open = await findOpenChannelDelivery(owner, subject, input.outlet, identityId);
    if (open) return { ok: true, data: { already: true, deliveryId: open.id, status: open.status } };
    const d = await createChannelDelivery(owner, { subject, outlet: input.outlet, status: 'dismissed', identityId, payload: { suggestion: String(input.text ?? '').slice(0, 200) } }, channelActor(ctx));
    return { ok: true, data: { deliveryId: d.id, status: 'dismissed' } };
  });
}

const OUTLET_WORDS: Record<string, string> = {
  site: 'the website', page: 'your page', market: 'the market', instagram: 'Instagram', facebook: 'Facebook', threads: 'Threads',
  youtube: 'YouTube', video: 'a video', writing: 'a piece of writing', live: 'a live', newsletter: 'the letter',
};

/** The step text when the caller gives none: "Post Salt Marsh to Instagram", as the loader words suggestions. */
function slotText(outlet: string, title: string): string {
  if (outlet === 'instagram') return `Post ${title} to Instagram`;
  if (outlet === 'facebook' || outlet === 'threads') return `Share ${title} to ${OUTLET_WORDS[outlet]}`;
  if (outlet === 'video') return `Film a short video about ${title}`;
  if (outlet === 'writing') return `Write about ${title}`;
  if (outlet === 'live') return `Go live with ${title}`;
  if (outlet === 'newsletter') return `Include ${title} in the letter`;
  return `${title} on ${OUTLET_WORDS[outlet] ?? outlet}`;
}

export interface SlotFillInput {
  routineId: string;
  /** The slot's instant (ISO), as `routineSlots` gives it. */
  at: string;
  pieceKey: string;
  text?: string;
}

/**
 * Fill a slot: the routine must be one the person runs in this channel (their
 * own, or an org's they run; only that org's with a scope org), `at` one of its
 * slots and still ahead, and the slot empty by the loader's rule (a delivery on
 * that routine, or an unattached one on its outlet, that day). The delivery is
 * the routine owner's, under the owner's name.
 */
export function fillSlot(ctx: ChannelCallContext, input: SlotFillInput): Promise<ActionResult> {
  return guarded(async () => {
    const subject = parseChannelPieceKey(input.pieceKey);
    if (!subject) return { ok: false, error: 'Name the piece as thread:<id> or artwork:<id>.', code: 'input' };
    const when = new Date(input.at);
    if (Number.isNaN(when.getTime())) return { ok: false, error: 'That time is not a date.', code: 'input' };
    const a = await channelActing(ctx.userId);
    const scopeOrg = ctx.orgId ?? null;
    if (scopeOrg && !a.orgIds.includes(scopeOrg)) return forbidden('That channel is not yours.');
    const owners: ChannelOwner[] = scopeOrg ? [{ kind: 'org', id: scopeOrg }] : [{ kind: 'user', id: a.userId }, ...a.orgIds.map((id) => ({ kind: 'org' as const, id }))];
    const routine = (await listChannelRoutines(owners)).find((r) => r.id === input.routineId);
    if (!routine) return forbidden('That routine is not one of yours.');
    const piece = await channelPiece(a, subject, 'deliver');
    if (!piece) return forbidden('That piece is not yours.');
    if (when.getTime() <= Date.now()) return { ok: false, error: 'That slot has passed.' };
    const date = zonedDate(when, TIME_ZONE);
    const slot = routineSlots([routine], date, date, TIME_ZONE).find((s) => Date.parse(s.at) === when.getTime());
    if (!slot) return { ok: false, error: `${routine.name} has no slot at that time.` };
    const owner = routine.owner;
    const filling = (await listChannelDeliveries([owner])).find(
      (d) =>
        d.status !== 'dismissed' &&
        (d.routineId ? d.routineId === routine.id : d.outlet === routine.outlet) &&
        d.scheduledAt &&
        zonedDate(new Date(d.scheduledAt), TIME_ZONE) === date,
    );
    if (filling) {
      return filling.subject.kind === subject.kind && filling.subject.id === subject.id
        ? { ok: true, data: { already: true, deliveryId: filling.id, status: filling.status } }
        : { ok: false, error: 'That slot is already filled.' };
    }
    const actor = channelActor(ctx);
    const identityId = channelIdentityOf(a, owner);
    const text = (input.text?.trim() || slotText(routine.outlet, piece.title)).slice(0, 200);
    const d = await createChannelDelivery(owner, { subject, outlet: routine.outlet, status: 'draft', identityId, scheduledAt: slot.at, routineId: routine.id, payload: { title: text, suggestion: text } }, actor);
    const plan = await addChannelPlanStep(owner, subject, { text, fromBoard: true, on: slot.at.slice(0, 10) }, actor);
    return { ok: true, data: { deliveryId: d.id, planId: plan.id, status: 'draft', scheduledAt: slot.at, routineId: routine.id } };
  });
}

export interface PlanStepInput {
  pieceKey: string;
  /** Whose plan: the piece's owner as the channel shows it (`user:<uuid>` / `org:<id>`). Default: the scope org, else the person. */
  identityId?: string | null;
  op: 'add' | 'check' | 'uncheck';
  /** The step's text: what to append, or the step as the caller read it (a mismatch is refused). */
  text: string;
  /** For check / uncheck: the step's position among the Steps lines. */
  index?: number;
  /** For add: a date tag (YYYY-MM-DD). */
  on?: string | null;
}

/** Append or tick a step in plan.md (actions.ts setPlanStepAction; adding is new). */
export function planStep(ctx: ChannelCallContext, input: PlanStepInput): Promise<ActionResult> {
  return guarded(async () => {
    const got = await target(ctx, input.pieceKey, input.identityId, 'plan');
    if (got.ok === false) return got.r;
    const { owner, subject } = got.t;
    const actor = channelActor(ctx);
    if (input.op === 'add') {
      const plan = await addChannelPlanStep(owner, subject, { text: input.text, on: input.on ?? null }, actor);
      return { ok: true, data: { planId: plan.id, op: 'add' } };
    }
    const plan = await setChannelPlanStep(owner, subject, input.index!, input.op === 'check', actor, input.text);
    return { ok: true, data: { planId: plan.id, op: input.op, index: input.index } };
  });
}
