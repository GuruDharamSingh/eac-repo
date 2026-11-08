import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { addPlanDate, addPlanStep, emptyPlan, parsePlan, setPlanStepDone } from './channel-plan-md';

// ============================================================================
// Channel: what a person (or an org) plans to publish, around each piece.
//
// Four tables (migration 252): routines open slots in the week, deliveries
// are what Channel itself plans for a piece on an outlet (draft, scheduled,
// an accepted suggestion, a dismissed one), plans hold a piece's plan.md with
// an append-only event log, and to-dos are the person's own notes on a day.
//
// History — what already went out — is not stored here. The app's loader
// reads it from the tables that record it (threads, social posts, publish
// jobs, artwork, email sends). docs/open/channel.md.
//
// Every read is scoped by owner; every write takes the acting user and an
// actor kind, so an agent's change is attributable. Until 252 is applied the
// reads return nothing and the writes throw ChannelNotReady.
// ============================================================================

export type ChannelOwnerKind = 'user' | 'org';
export interface ChannelOwner {
  kind: ChannelOwnerKind;
  id: string;
}
export type ChannelSubjectKind = 'thread' | 'artwork';
export interface ChannelSubject {
  kind: ChannelSubjectKind;
  id: string;
}
export type ChannelActorKind = 'user' | 'agent';
export interface ChannelActor {
  kind: ChannelActorKind;
  /** users.id for a person; the agent's registry id for an agent. */
  id: string;
  /** The signed-in user on whose behalf the change is made. */
  userId: string;
}

export const CHANNEL_OUTLETS = [
  'site',
  'page',
  'market',
  'instagram',
  'facebook',
  'threads',
  'youtube',
  'video',
  'writing',
  'live',
  'newsletter',
] as const;
export type ChannelOutlet = (typeof CHANNEL_OUTLETS)[number];

export type ChannelDeliveryStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'dismissed';

/** "Just me" rows live under the personal org, as Studio posts do. */
export const CHANNEL_PERSONAL_ORG = 'oad';

export function channelOrgId(owner: ChannelOwner): string {
  return owner.kind === 'org' ? owner.id : CHANNEL_PERSONAL_ORG;
}

export class ChannelNotReady extends Error {
  constructor() {
    super('Channel planning is not switched on yet (migration 252 is not applied).');
    this.name = 'ChannelNotReady';
  }
}

function isMissingTable(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '42P01';
}

async function read<T>(fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isMissingTable(err)) return fallback;
    throw err;
  }
}

async function write<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isMissingTable(err)) throw new ChannelNotReady();
    throw err;
  }
}

/** True once migration 252 is applied. */
export async function channelReady(): Promise<boolean> {
  return read(false, async () => {
    await db`SELECT 1 FROM channel_plans LIMIT 0`;
    return true;
  });
}

const iso = (d: Date | string | null | undefined): string | null =>
  d ? (d instanceof Date ? d.toISOString() : new Date(d).toISOString()) : null;

// ── Routines and their slots ────────────────────────────────────────────────

export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export interface RoutineCadence {
  weekdays?: Weekday[];
  monthDay?: number;
  nthWeekday?: { n: number; weekday: Weekday };
  /** "HH:MM", local to the viewer's time zone. */
  time?: string;
}

export interface ChannelRoutine {
  id: string;
  orgId: string;
  owner: ChannelOwner;
  name: string;
  outlet: string;
  cadence: RoutineCadence;
  source: 'channel' | 'sophia';
  sourceRef: string | null;
  createdAt: string;
}

interface RoutineRow {
  id: string;
  org_id: string;
  owner_kind: ChannelOwnerKind;
  owner_id: string;
  name: string;
  outlet: string;
  cadence: RoutineCadence | null;
  source: 'channel' | 'sophia';
  source_ref: string | null;
  created_at: Date;
}

function mapRoutine(r: RoutineRow): ChannelRoutine {
  return {
    id: r.id,
    orgId: r.org_id,
    owner: { kind: r.owner_kind, id: r.owner_id },
    name: r.name,
    outlet: r.outlet,
    cadence: r.cadence ?? {},
    source: r.source,
    sourceRef: r.source_ref,
    createdAt: iso(r.created_at)!,
  };
}

/** Routines of every owner given (the artist plus the orgs shown with them). */
export async function listChannelRoutines(owners: ChannelOwner[]): Promise<ChannelRoutine[]> {
  if (owners.length === 0) return [];
  return read([] as ChannelRoutine[], async () => {
    const keys = owners.map((o) => `${o.kind}:${o.id}`);
    const rows = await db<RoutineRow[]>`
      SELECT id, org_id, owner_kind, owner_id, name, outlet, cadence, source, source_ref, created_at
      FROM channel_routines
      WHERE archived_at IS NULL AND (owner_kind || ':' || owner_id) = ANY(${keys})
      ORDER BY created_at
    `;
    return rows.map(mapRoutine);
  });
}

export function cleanCadence(input: RoutineCadence): RoutineCadence {
  const out: RoutineCadence = {};
  if (Array.isArray(input.weekdays)) {
    const days = input.weekdays.filter((d): d is Weekday => WEEKDAYS.includes(d));
    if (days.length) out.weekdays = [...new Set(days)];
  }
  if (typeof input.monthDay === 'number' && input.monthDay >= 1 && input.monthDay <= 28) out.monthDay = Math.round(input.monthDay);
  if (input.nthWeekday && WEEKDAYS.includes(input.nthWeekday.weekday) && input.nthWeekday.n >= 1 && input.nthWeekday.n <= 4) {
    out.nthWeekday = { n: Math.round(input.nthWeekday.n), weekday: input.nthWeekday.weekday };
  }
  if (typeof input.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) out.time = input.time;
  return out;
}

export async function createChannelRoutine(
  owner: ChannelOwner,
  input: { name: string; outlet: string; cadence: RoutineCadence },
  actor: ChannelActor
): Promise<ChannelRoutine> {
  const name = input.name.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!name) throw new Error('Give the routine a name.');
  if (!(CHANNEL_OUTLETS as readonly string[]).includes(input.outlet)) throw new Error('Unknown outlet.');
  const cadence = cleanCadence(input.cadence);
  if (!cadence.weekdays && !cadence.monthDay && !cadence.nthWeekday) throw new Error('Choose when it repeats.');
  return write(async () => {
    const [row] = await db<RoutineRow[]>`
      INSERT INTO channel_routines (id, org_id, owner_kind, owner_id, name, outlet, cadence, source, created_by)
      VALUES (${nanoid()}, ${channelOrgId(owner)}, ${owner.kind}, ${owner.id}, ${name}, ${input.outlet},
              ${db.json(cadence as never)}, 'channel', ${actor.userId})
      RETURNING id, org_id, owner_kind, owner_id, name, outlet, cadence, source, source_ref, created_at
    `;
    return mapRoutine(row!);
  });
}

/** The routine exists, is live, and belongs to this owner. */
export async function channelRoutineOwnedBy(owner: ChannelOwner, id: string): Promise<boolean> {
  return read(false, async () => {
    const rows = await db<Array<{ ok: boolean }>>`
      SELECT true AS ok FROM channel_routines
      WHERE id = ${id} AND org_id = ${channelOrgId(owner)} AND owner_kind = ${owner.kind} AND owner_id = ${owner.id}
        AND archived_at IS NULL
    `;
    return Boolean(rows[0]);
  });
}

/** Change a routine's name, outlet or cadence (the planner, 2026-11-07). Fields left out stay. */
export async function updateChannelRoutine(
  owner: ChannelOwner,
  id: string,
  patch: { name?: string; outlet?: string; cadence?: RoutineCadence }
): Promise<ChannelRoutine | null> {
  const name = patch.name === undefined ? null : patch.name.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (name === '') throw new Error('Give the routine a name.');
  if (patch.outlet !== undefined && !(CHANNEL_OUTLETS as readonly string[]).includes(patch.outlet)) throw new Error('Unknown outlet.');
  const cadence = patch.cadence === undefined ? null : cleanCadence(patch.cadence);
  if (cadence && !cadence.weekdays && !cadence.monthDay && !cadence.nthWeekday) throw new Error('Choose when it repeats.');
  return write(async () => {
    const [row] = await db<RoutineRow[]>`
      UPDATE channel_routines SET
        name = COALESCE(${name}, name),
        outlet = COALESCE(${patch.outlet ?? null}, outlet),
        cadence = CASE WHEN ${cadence === null} THEN cadence ELSE ${db.json((cadence ?? {}) as never)} END,
        updated_at = now()
      WHERE id = ${id} AND org_id = ${channelOrgId(owner)} AND owner_kind = ${owner.kind} AND owner_id = ${owner.id}
        AND archived_at IS NULL
      RETURNING id, org_id, owner_kind, owner_id, name, outlet, cadence, source, source_ref, created_at
    `;
    return row ? mapRoutine(row) : null;
  });
}

export async function archiveChannelRoutine(owner: ChannelOwner, id: string): Promise<void> {
  await write(async () => {
    await db`
      UPDATE channel_routines SET archived_at = now(), updated_at = now()
      WHERE id = ${id} AND org_id = ${channelOrgId(owner)} AND owner_kind = ${owner.kind} AND owner_id = ${owner.id}
    `;
  });
}

/** Offset of `timeZone` from UTC at `at`, in minutes. */
function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** A local wall-clock time (YYYY-MM-DD, HH:MM) in `timeZone` as a UTC instant. */
export function zonedInstant(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offset = zoneOffsetMinutes(guess, timeZone);
  const first = new Date(guess.getTime() - offset * 60000);
  const offset2 = zoneOffsetMinutes(first, timeZone);
  return offset2 === offset ? first : new Date(guess.getTime() - offset2 * 60000);
}

/** YYYY-MM-DD of an instant, in `timeZone`. */
export function zonedDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

function weekdayOf(date: string): Weekday {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export interface RoutineSlot {
  routineId: string;
  outlet: string;
  /** Local date, YYYY-MM-DD. */
  date: string;
  at: string;
}

/** The slots a set of routines opens between two local dates (inclusive). Computed, never stored. */
export function routineSlots(routines: ChannelRoutine[], from: string, to: string, timeZone: string): RoutineSlot[] {
  const out: RoutineSlot[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const wd = weekdayOf(date);
    const dom = Number(date.slice(8, 10));
    for (const r of routines) {
      const c = r.cadence;
      let hit = false;
      if (c.weekdays?.includes(wd)) hit = true;
      if (c.monthDay && c.monthDay === dom) hit = true;
      if (c.nthWeekday && c.nthWeekday.weekday === wd && Math.ceil(dom / 7) === c.nthWeekday.n) hit = true;
      if (!hit) continue;
      out.push({ routineId: r.id, outlet: r.outlet, date, at: zonedInstant(date, c.time ?? '10:00', timeZone).toISOString() });
    }
  }
  return out;
}

const DAY_NAMES: Record<Weekday, string> = {
  sun: 'Sundays',
  mon: 'Mondays',
  tue: 'Tuesdays',
  wed: 'Wednesdays',
  thu: 'Thursdays',
  fri: 'Fridays',
  sat: 'Saturdays',
};
const ORDINAL = ['', 'First', 'Second', 'Third', 'Fourth'];

/** "Tuesdays and Fridays", "1st of the month", "Second Sunday". */
export function describeCadence(c: RoutineCadence): string {
  const parts: string[] = [];
  if (c.weekdays?.length) {
    const names = WEEKDAYS.filter((d) => c.weekdays!.includes(d)).map((d) => DAY_NAMES[d]);
    parts.push(names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]);
  }
  if (c.monthDay) {
    const n = c.monthDay;
    const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
    parts.push(`${n}${suffix} of the month`);
  }
  if (c.nthWeekday) parts.push(`${ORDINAL[c.nthWeekday.n]} ${DAY_NAMES[c.nthWeekday.weekday].replace(/s$/, '')}`);
  return parts.join(' · ') || 'No days set';
}

// ── Deliveries ──────────────────────────────────────────────────────────────

export interface ChannelDelivery {
  id: string;
  orgId: string;
  owner: ChannelOwner;
  identityId: string | null;
  subject: ChannelSubject;
  outlet: string;
  status: ChannelDeliveryStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  permalink: string | null;
  payload: Record<string, unknown>;
  routineId: string | null;
  actorKind: ChannelActorKind;
  createdAt: string;
  updatedAt: string;
}

interface DeliveryRow {
  id: string;
  org_id: string;
  owner_kind: ChannelOwnerKind;
  owner_id: string;
  identity_id: string | null;
  subject_kind: ChannelSubjectKind;
  subject_id: string;
  outlet: string;
  status: ChannelDeliveryStatus;
  scheduled_at: Date | null;
  published_at: Date | null;
  permalink: string | null;
  payload: Record<string, unknown> | null;
  routine_id: string | null;
  actor_kind: ChannelActorKind;
  created_at: Date;
  updated_at: Date;
}

function mapDelivery(r: DeliveryRow): ChannelDelivery {
  return {
    id: r.id,
    orgId: r.org_id,
    owner: { kind: r.owner_kind, id: r.owner_id },
    identityId: r.identity_id,
    subject: { kind: r.subject_kind, id: r.subject_id },
    outlet: r.outlet,
    status: r.status,
    scheduledAt: iso(r.scheduled_at),
    publishedAt: iso(r.published_at),
    permalink: r.permalink,
    payload: r.payload ?? {},
    routineId: r.routine_id,
    actorKind: r.actor_kind,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

export async function listChannelDeliveries(owners: ChannelOwner[]): Promise<ChannelDelivery[]> {
  if (owners.length === 0) return [];
  return read([] as ChannelDelivery[], async () => {
    const keys = owners.map((o) => `${o.kind}:${o.id}`);
    const rows = await db<DeliveryRow[]>`
      SELECT * FROM channel_deliveries
      WHERE (owner_kind || ':' || owner_id) = ANY(${keys})
      ORDER BY COALESCE(scheduled_at, created_at)
      LIMIT 2000
    `;
    return rows.map(mapDelivery);
  });
}

/**
 * A delivery Channel already holds for this piece, outlet and name, that is
 * still open (draft or scheduled) or was dismissed. Accepting a suggestion
 * twice, or dismissing it twice, finds this and writes nothing.
 */
export async function findOpenChannelDelivery(
  owner: ChannelOwner,
  subject: ChannelSubject,
  outlet: string,
  identityId: string | null
): Promise<ChannelDelivery | null> {
  return read(null as ChannelDelivery | null, async () => {
    const rows = await db<DeliveryRow[]>`
      SELECT * FROM channel_deliveries
      WHERE org_id = ${channelOrgId(owner)} AND owner_kind = ${owner.kind} AND owner_id = ${owner.id}
        AND subject_kind = ${subject.kind} AND subject_id = ${subject.id} AND outlet = ${outlet}
        AND identity_id IS NOT DISTINCT FROM ${identityId}
        AND status IN ('draft', 'scheduled', 'dismissed')
      ORDER BY created_at DESC LIMIT 1
    `;
    return rows[0] ? mapDelivery(rows[0]) : null;
  });
}

export interface DeliveryInput {
  subject: ChannelSubject;
  outlet: string;
  status: 'draft' | 'scheduled' | 'dismissed';
  identityId?: string | null;
  scheduledAt?: string | null;
  routineId?: string | null;
  payload?: Record<string, unknown>;
}

function cleanDelivery(input: DeliveryInput): DeliveryInput {
  if (!(CHANNEL_OUTLETS as readonly string[]).includes(input.outlet)) throw new Error('Unknown outlet.');
  if (input.subject.kind !== 'thread' && input.subject.kind !== 'artwork') throw new Error('Unknown piece.');
  if (input.status === 'scheduled' && !input.scheduledAt) throw new Error('Choose when it goes out.');
  const when = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (when && Number.isNaN(when.getTime())) throw new Error('That time is not a date.');
  return { ...input, scheduledAt: when ? when.toISOString() : null };
}

export async function createChannelDelivery(owner: ChannelOwner, input: DeliveryInput, actor: ChannelActor): Promise<ChannelDelivery> {
  const d = cleanDelivery(input);
  return write(async () => {
    const [row] = await db<DeliveryRow[]>`
      INSERT INTO channel_deliveries
        (id, org_id, owner_kind, owner_id, identity_id, subject_kind, subject_id, outlet, status,
         scheduled_at, payload, routine_id, actor_kind, created_by)
      VALUES (${nanoid()}, ${channelOrgId(owner)}, ${owner.kind}, ${owner.id}, ${d.identityId ?? null},
              ${d.subject.kind}, ${d.subject.id}, ${d.outlet}, ${d.status}, ${d.scheduledAt ?? null},
              ${db.json((d.payload ?? {}) as never)}, ${d.routineId ?? null}, ${actor.kind}, ${actor.userId})
      RETURNING *
    `;
    return mapDelivery(row!);
  });
}

export async function updateChannelDelivery(
  owner: ChannelOwner,
  id: string,
  patch: { status?: 'draft' | 'scheduled' | 'dismissed'; scheduledAt?: string | null; payload?: Record<string, unknown> }
): Promise<ChannelDelivery | null> {
  return write(async () => {
    const when = patch.scheduledAt === undefined ? undefined : patch.scheduledAt ? new Date(patch.scheduledAt).toISOString() : null;
    const [row] = await db<DeliveryRow[]>`
      UPDATE channel_deliveries SET
        status = COALESCE(${patch.status ?? null}, status),
        scheduled_at = CASE WHEN ${when === undefined} THEN scheduled_at ELSE ${when ?? null}::timestamptz END,
        payload = COALESCE(payload, '{}'::jsonb) || ${db.json((patch.payload ?? {}) as never)},
        updated_at = now()
      WHERE id = ${id} AND org_id = ${channelOrgId(owner)} AND owner_kind = ${owner.kind} AND owner_id = ${owner.id}
        AND status IN ('draft', 'scheduled', 'dismissed', 'failed')
      RETURNING *
    `;
    return row ? mapDelivery(row) : null;
  });
}

// ── Plans (plan.md) ─────────────────────────────────────────────────────────

export interface ChannelPlan {
  id: string;
  orgId: string;
  owner: ChannelOwner;
  subject: ChannelSubject;
  bodyMd: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  updatedByActor: ChannelActorKind;
}

export interface ChannelPlanEvent {
  id: number;
  actorKind: ChannelActorKind;
  actorId: string;
  verb: string;
  diff: Record<string, unknown>;
  createdAt: string;
}

interface PlanRow {
  id: string;
  org_id: string;
  owner_kind: ChannelOwnerKind;
  owner_id: string;
  subject_kind: ChannelSubjectKind;
  subject_id: string;
  body_md: string;
  created_at: Date;
  updated_at: Date;
  updated_by: string | null;
  updated_by_actor: ChannelActorKind;
}

function mapPlan(r: PlanRow): ChannelPlan {
  return {
    id: r.id,
    orgId: r.org_id,
    owner: { kind: r.owner_kind, id: r.owner_id },
    subject: { kind: r.subject_kind, id: r.subject_id },
    bodyMd: r.body_md,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
    updatedBy: r.updated_by,
    updatedByActor: r.updated_by_actor,
  };
}

/** Every plan these owners hold (one per piece). */
export async function listChannelPlans(owners: ChannelOwner[]): Promise<ChannelPlan[]> {
  if (owners.length === 0) return [];
  return read([] as ChannelPlan[], async () => {
    const keys = owners.map((o) => `${o.kind}:${o.id}`);
    const rows = await db<PlanRow[]>`
      SELECT * FROM channel_plans WHERE (owner_kind || ':' || owner_id) = ANY(${keys})
    `;
    return rows.map(mapPlan);
  });
}

export async function listChannelPlanEvents(planId: string, limit = 50): Promise<ChannelPlanEvent[]> {
  return read([] as ChannelPlanEvent[], async () => {
    const rows = await db<Array<{ id: number; actor_kind: ChannelActorKind; actor_id: string; verb: string; diff: Record<string, unknown>; created_at: Date }>>`
      SELECT id, actor_kind, actor_id, verb, diff, created_at FROM channel_plan_events
      WHERE plan_id = ${planId} ORDER BY created_at DESC, id DESC LIMIT ${limit}
    `;
    return rows.map((r) => ({ id: Number(r.id), actorKind: r.actor_kind, actorId: r.actor_id, verb: r.verb, diff: r.diff ?? {}, createdAt: iso(r.created_at)! }));
  });
}

// A transaction handle: postgres.js TransactionSql extends Sql, so `typeof db` types it.
type Tx = typeof db;

async function lockPlan(tx: Tx, owner: ChannelOwner, subject: ChannelSubject, actor: ChannelActor): Promise<PlanRow> {
  const inserted = await tx<PlanRow[]>`
    INSERT INTO channel_plans (id, org_id, owner_kind, owner_id, subject_kind, subject_id, body_md, updated_by, updated_by_actor)
    VALUES (${nanoid()}, ${channelOrgId(owner)}, ${owner.kind}, ${owner.id}, ${subject.kind}, ${subject.id},
            ${emptyPlan()}, ${actor.userId}, ${actor.kind})
    ON CONFLICT (owner_kind, owner_id, subject_kind, subject_id) DO NOTHING
    RETURNING *
  `;
  if (inserted[0]) {
    await tx`
      INSERT INTO channel_plan_events (plan_id, org_id, actor_kind, actor_id, verb, diff)
      VALUES (${inserted[0].id}, ${inserted[0].org_id}, ${actor.kind}, ${actor.id}, 'created', ${db.json({} as never)})
    `;
    return inserted[0];
  }
  const [found] = await tx<PlanRow[]>`
    SELECT * FROM channel_plans
    WHERE owner_kind = ${owner.kind} AND owner_id = ${owner.id}
      AND subject_kind = ${subject.kind} AND subject_id = ${subject.id}
    FOR UPDATE
  `;
  return found!;
}

/** A save made from an older copy of the plan than the one stored. */
export class ChannelPlanConflict extends Error {
  constructor() {
    super('This plan changed since you opened it. Reload to see the newer version.');
    this.name = 'ChannelPlanConflict';
  }
}

async function changePlan(
  owner: ChannelOwner,
  subject: ChannelSubject,
  actor: ChannelActor,
  verb: string,
  edit: (md: string) => string,
  diff: Record<string, unknown>,
  expectedUpdatedAt?: string | null
): Promise<ChannelPlan> {
  return write(() =>
    db.begin(async (tx) => {
      const plan = await lockPlan(tx as unknown as Tx, owner, subject, actor);
      // Whole-body saves carry the version they were made from; a step add or
      // tick edits the stored body and needs no check.
      if (expectedUpdatedAt && Math.abs(new Date(plan.updated_at).getTime() - new Date(expectedUpdatedAt).getTime()) > 1) {
        throw new ChannelPlanConflict();
      }
      const next = edit(plan.body_md).slice(0, 40_000);
      const [row] = await tx<PlanRow[]>`
        UPDATE channel_plans SET body_md = ${next}, updated_at = now(),
          updated_by = ${actor.userId}, updated_by_actor = ${actor.kind}
        WHERE id = ${plan.id}
        RETURNING *
      `;
      await tx`
        INSERT INTO channel_plan_events (plan_id, org_id, actor_kind, actor_id, verb, diff)
        VALUES (${plan.id}, ${plan.org_id}, ${actor.kind}, ${actor.id}, ${verb}, ${db.json(diff as never)})
      `;
      return mapPlan(row!);
    })
  );
}

/** Start a piece's plan (empty outline) the moment it joins the queue. Idempotent. */
export async function ensureChannelPlan(owner: ChannelOwner, subject: ChannelSubject, actor: ChannelActor): Promise<ChannelPlan> {
  return write(() => db.begin(async (tx) => mapPlan(await lockPlan(tx as unknown as Tx, owner, subject, actor))));
}

export async function saveChannelPlan(
  owner: ChannelOwner,
  subject: ChannelSubject,
  bodyMd: string,
  actor: ChannelActor,
  expectedUpdatedAt?: string | null
): Promise<ChannelPlan> {
  const body = bodyMd.replace(/\r\n/g, '\n');
  return changePlan(owner, subject, actor, 'edited', () => body, { length: body.length }, expectedUpdatedAt);
}

export async function addChannelPlanStep(
  owner: ChannelOwner,
  subject: ChannelSubject,
  step: { text: string; fromBoard?: boolean; on?: string | null; date?: string | null },
  actor: ChannelActor
): Promise<ChannelPlan> {
  return changePlan(
    owner,
    subject,
    actor,
    'step_added',
    (md) => {
      let out = addPlanStep(md, step.text, { fromBoard: step.fromBoard, on: step.on });
      if (step.date) out = addPlanDate(out, step.date);
      return out;
    },
    { text: step.text, fromBoard: Boolean(step.fromBoard) }
  );
}

export async function setChannelPlanStep(
  owner: ChannelOwner,
  subject: ChannelSubject,
  index: number,
  done: boolean,
  actor: ChannelActor,
  /** The step's text as the caller saw it: a step added since shifts indexes, so a mismatch is refused. */
  expectedText?: string | null
): Promise<ChannelPlan> {
  return changePlan(
    owner,
    subject,
    actor,
    done ? 'step_checked' : 'step_unchecked',
    (md) => {
      if (expectedText != null && parsePlan(md).steps[index]?.text !== expectedText) throw new ChannelPlanConflict();
      return setPlanStepDone(md, index, done);
    },
    { index }
  );
}

// ── To-dos ──────────────────────────────────────────────────────────────────

export interface ChannelTodo {
  id: string;
  owner: ChannelOwner;
  date: string | null;
  text: string;
  done: boolean;
  subject: ChannelSubject | null;
  createdAt: string;
}

interface TodoRow {
  id: string;
  owner_kind: ChannelOwnerKind;
  owner_id: string;
  date: string | Date | null;
  text: string;
  done: boolean;
  subject_kind: ChannelSubjectKind | null;
  subject_id: string | null;
  created_at: Date;
}

function mapTodo(r: TodoRow): ChannelTodo {
  const date = r.date ? (r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10)) : null;
  return {
    id: r.id,
    owner: { kind: r.owner_kind, id: r.owner_id },
    date,
    text: r.text,
    done: r.done,
    subject: r.subject_kind && r.subject_id ? { kind: r.subject_kind, id: r.subject_id } : null,
    createdAt: iso(r.created_at)!,
  };
}

/** Dated to-dos in a range plus every undated open one (the "not placed" tray). */
export async function listChannelTodos(owner: ChannelOwner, from: string, to: string): Promise<ChannelTodo[]> {
  return read([] as ChannelTodo[], async () => {
    const rows = await db<TodoRow[]>`
      SELECT id, owner_kind, owner_id, to_char(date, 'YYYY-MM-DD') AS date, text, done, subject_kind, subject_id, created_at
      FROM channel_todos
      WHERE owner_kind = ${owner.kind} AND owner_id = ${owner.id}
        AND ((date BETWEEN ${from}::date AND ${to}::date) OR (date IS NULL AND done = false)
             OR (date < ${from}::date AND done = false AND subject_id IS NOT NULL))
      ORDER BY date NULLS LAST, created_at
      LIMIT 500
    `;
    return rows.map(mapTodo);
  });
}

export async function addChannelTodo(
  owner: ChannelOwner,
  input: { text: string; date?: string | null; subject?: ChannelSubject | null },
  actor: ChannelActor
): Promise<ChannelTodo> {
  const text = input.text.replace(/\s+/g, ' ').trim().slice(0, 240);
  if (!text) throw new Error('Write the to-do first.');
  const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null;
  return write(async () => {
    const [row] = await db<TodoRow[]>`
      INSERT INTO channel_todos (id, org_id, owner_kind, owner_id, date, text, subject_kind, subject_id, created_by)
      VALUES (${nanoid()}, ${channelOrgId(owner)}, ${owner.kind}, ${owner.id}, ${date}, ${text},
              ${input.subject?.kind ?? null}, ${input.subject?.id ?? null}, ${actor.userId})
      RETURNING id, owner_kind, owner_id, to_char(date, 'YYYY-MM-DD') AS date, text, done, subject_kind, subject_id, created_at
    `;
    return mapTodo(row!);
  });
}

export async function setChannelTodoDone(owner: ChannelOwner, id: string, done: boolean): Promise<void> {
  await write(async () => {
    await db`
      UPDATE channel_todos SET done = ${done}, done_at = ${done ? new Date() : null}, updated_at = now()
      WHERE id = ${id} AND org_id = ${channelOrgId(owner)} AND owner_kind = ${owner.kind} AND owner_id = ${owner.id}
    `;
  });
}

// ── Rules: "never suggest this" (migration 255) ─────────────────────────────

export interface ChannelRule {
  id: string;
  owner: ChannelOwner;
  outlet: string | null;
  pieceKind: string | null;
}

/** An owner's "never suggest" rules. Empty until migration 255 is applied. */
export async function listChannelRules(owners: ChannelOwner[]): Promise<ChannelRule[]> {
  if (owners.length === 0) return [];
  return read([] as ChannelRule[], async () => {
    const keys = owners.map((o) => `${o.kind}:${o.id}`);
    const rows = await db<Array<{ id: string; owner_kind: ChannelOwnerKind; owner_id: string; outlet: string | null; piece_kind: string | null }>>`
      SELECT id, owner_kind, owner_id, outlet, piece_kind FROM channel_rules
      WHERE rule = 'never_suggest' AND (owner_kind || ':' || owner_id) = ANY(${keys})
    `;
    return rows.map((r) => ({ id: r.id, owner: { kind: r.owner_kind, id: r.owner_id }, outlet: r.outlet, pieceKind: r.piece_kind }));
  });
}

/** Stop suggesting `outlet` for pieces of `pieceKind` (either may be null for "any"). Idempotent. */
export async function addChannelRule(owner: ChannelOwner, rule: { outlet: string | null; pieceKind: string | null }, actor: ChannelActor): Promise<void> {
  if (rule.outlet !== null && !(CHANNEL_OUTLETS as readonly string[]).includes(rule.outlet)) throw new Error('Unknown outlet.');
  if (rule.outlet === null && rule.pieceKind === null) throw new Error('Name an outlet or a kind of piece.');
  const kind = rule.pieceKind ? rule.pieceKind.replace(/[^a-z]/g, '').slice(0, 20) || null : null;
  await write(async () => {
    await db`
      INSERT INTO channel_rules (id, org_id, owner_kind, owner_id, rule, outlet, piece_kind, created_by)
      VALUES (${nanoid()}, ${channelOrgId(owner)}, ${owner.kind}, ${owner.id}, 'never_suggest', ${rule.outlet}, ${kind}, ${actor.userId})
      ON CONFLICT DO NOTHING
    `;
  });
}

export async function removeChannelRule(owner: ChannelOwner, id: string): Promise<void> {
  await write(async () => {
    await db`DELETE FROM channel_rules WHERE id = ${id} AND org_id = ${channelOrgId(owner)} AND owner_kind = ${owner.kind} AND owner_id = ${owner.id}`;
  });
}

