// ============================================================================
// One RSVP logic (docs/open/RSVP_BOOKING_ONE_LOGIC_2026-11-16.md, step 1).
//
// The rules are pure and live in @elkdonis/booking/core (rsvp.ts, tested by
// packages/booking/scripts/check-rsvp.mts). This file reads and writes the
// rows around them and offers two route factories that every app mounts as a
// thin shim, in the style of `followRoutes` (org-site-routes.ts):
//
//   export const { GET, POST, DELETE } = rsvpRoutes({ ... });      // member door
//   export const { GET, POST } = guestRsvpRoutes({ ... });          // guest door
//
// Behaviour in one place:
//   - a thread is found by id, org and `published` only. It is NEVER filtered
//     on visibility unless an app asks for 'public-only': members-only
//     threads can be RSVP'd by design (#42), and an RSVP gives the host the
//     person's member info. The next reader should not "fix" that.
//   - the member rule: any signed-in person may RSVP; the role is not checked
//     here. Publishing under the org's name is a different gate, untouched.
//   - capacity is checked and written under one `SELECT ... FOR UPDATE` on the
//     thread row, so two people cannot both take the last seat.
//   - a full thread writes `waitlist`; a cancel promotes the oldest in line.
//   - a priced thread is never joined free (#44): the app gives a `paid`
//     callback (checkout) or the route answers 402. A person already on
//     "yes" keeps it (the comp).
//   - a guest RSVP counts only after the emailed link is clicked.
//   - an RSVP may make the person a follower of the org (followOnRsvp), never
//     a mail subscriber.
//
// Columns and tables from migration 278 are optional: every use of one is
// guarded by `schemaHas`, and without them the code runs as before minus that
// feature (no hold on a promotion, no attended mark, no refund record, orgs
// all open).
// ============================================================================

import { createHash, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { nanoid } from 'nanoid';
import { db } from '@elkdonis/db';
import {
  GUEST_PER_EMAIL_PER_HOUR,
  GUEST_PER_IP_PER_HOUR,
  GUEST_VERIFY_HOURS,
  attendedAllowed,
  cleanGuestInput,
  decideRsvp,
  followDecision,
  guestRateLimited,
  guestRsvpState,
  pickPromotions,
  refundOnCancel,
  seatsFree,
  type OrgJoinPolicy,
  type RsvpRole,
  type RsvpStatusValue,
} from '@elkdonis/booking/core';
import { sendRsvpConfirmation, sendRsvpNotification } from '@elkdonis/email';
import { isWithinCurrentCycle } from '@elkdonis/utils';

// ---------------------------------------------------------------- mail seam

export interface RsvpMail {
  to: string;
  subject: string;
  html: string;
  orgId: string;
  threadId?: string;
}

async function defaultMailer(m: RsvpMail): Promise<void> {
  const { sendEmail } = await import('@elkdonis/email');
  await sendEmail({ to: m.to, subject: m.subject, html: m.html, orgId: m.orgId, kind: 'rsvp', threadId: m.threadId });
}

let mailer: (m: RsvpMail) => Promise<void> = defaultMailer;

/** Scripts replace the transport so nothing is sent. Pass null to restore. */
export function setRsvpMailer(fn: ((m: RsvpMail) => Promise<void>) | null): void {
  mailer = fn ?? defaultMailer;
}

async function sendMail(m: RsvpMail): Promise<void> {
  try {
    await mailer(m);
  } catch (err) {
    console.error(`[rsvp] email "${m.subject}" failed:`, err);
  }
}

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function mailBody(paragraphs: string[]): string {
  return `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#1f1f1f">${paragraphs
    .map((p) => `<p>${p}</p>`)
    .join('')}</div>`;
}

function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;padding:10px 18px;background:#1f1f1f;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600">${esc(label)}</a>`;
}

// ------------------------------------------------------------- schema probes

const probeCache = new Map<string, { has: boolean; at: number }>();

/** Does this table (or column) exist yet? True is cached; false is re-checked each minute. */
async function schemaHas(table: string, column?: string): Promise<boolean> {
  const key = `${table}.${column ?? ''}`;
  const hit = probeCache.get(key);
  const now = Date.now();
  if (hit && (hit.has || now - hit.at < 60_000)) return hit.has;
  let has = false;
  try {
    const rows = column
      ? await db`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column} LIMIT 1`
      : await db`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${table} LIMIT 1`;
    has = rows.length > 0;
  } catch {
    has = false;
  }
  probeCache.set(key, { has, at: now });
  return has;
}

const holdColumns = () => schemaHas('thread_rsvps', 'hold_expires_at');

// -------------------------------------------------------------- thread rows

export interface RsvpThread {
  id: string;
  org_id: string;
  kind: string;
  title: string;
  slug: string;
  section: string | null;
  scheduled_at: Date | null;
  duration_minutes: number | null;
  recurrence_pattern: string | null;
  location: string | null;
  meeting_url: string | null;
  min_attendees: number | null;
  notify_on_min_attendees: boolean;
  min_attendees_notified: boolean;
  is_rsvp_enabled: boolean;
  rsvp_deadline: Date | null;
  attendee_limit: number | null;
  author_id: string | null;
  author_email: string | null;
  /** MAJOR units, as stored (workshop_pages.price_member, else threads.price). */
  price: string | number | null;
  price_sliding_min: string | number | null;
}

/** MAJOR to minor, the boundary commerce works in. */
function toMinor(v: string | number | null | undefined): number {
  const n = v == null ? 0 : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

type Q = typeof db;

async function loadThread(
  q: Q,
  threadId: string,
  scope: { orgId: string | null; visibility?: 'any' | 'public-only'; lock?: boolean }
): Promise<RsvpThread | null> {
  const rows = await q<RsvpThread[]>`
    SELECT t.id, t.org_id, t.kind, t.title, t.slug, t.section, t.scheduled_at, t.duration_minutes,
           t.recurrence_pattern, t.location, t.meeting_url,
           t.min_attendees, t.notify_on_min_attendees, t.min_attendees_notified,
           t.is_rsvp_enabled, t.rsvp_deadline, t.attendee_limit,
           t.author_id, u.email AS author_email,
           COALESCE(wp.price_member, t.price) AS price,
           wp.price_sliding_min
    FROM threads t
    LEFT JOIN users u ON u.id = t.author_id
    LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
    WHERE t.id = ${threadId}
      AND t.status = 'published'
      ${scope.orgId ? q`AND t.org_id = ${scope.orgId}` : q``}
      ${scope.visibility === 'public-only' ? q`AND t.visibility = 'PUBLIC'` : q``}
    LIMIT 1
    ${scope.lock ? q`FOR UPDATE OF t` : q``}
  `;
  return rows[0] ?? null;
}

/**
 * Seats taken by anyone but `excludeUserId`: confirmed yes, unexpired promotion
 * holds, and verified guests.
 */
async function seatsTaken(q: Q, threadId: string, excludeUserId: string | null): Promise<number> {
  const holds = await holdColumns();
  const [m] = await q<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM thread_rsvps
    WHERE thread_id = ${threadId}
      ${excludeUserId ? q`AND user_id <> ${excludeUserId}` : q``}
      AND (status = 'yes' ${holds ? q`OR (status = 'waitlist' AND hold_expires_at > NOW())` : q``})
  `;
  const [g] = await q<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM guest_submissions
    WHERE thread_id = ${threadId} AND kind = 'rsvp' AND metadata->>'verified_at' IS NOT NULL
  `;
  return (m?.n ?? 0) + (g?.n ?? 0);
}

async function countYes(q: Q, threadId: string): Promise<number> {
  const [r] = await q<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM thread_rsvps WHERE thread_id = ${threadId} AND status = 'yes'
  `;
  return r?.n ?? 0;
}

function threadUrl(origin: string, t: Pick<RsvpThread, 'section' | 'slug'>): string {
  return t.section ? `${origin}/${t.section}/${t.slug}` : origin;
}

function defaultOrigin(): string {
  return (
    process.env.ARTS_COLLECTIVE_URL ??
    process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ??
    'https://arts-collective.com'
  ).replace(/\/$/, '');
}

async function roleOf(userId: string, orgId: string): Promise<RsvpRole> {
  const [r] = await db<Array<{ role: string }>>`
    SELECT role FROM user_organizations WHERE user_id = ${userId} AND org_id = ${orgId}
  `;
  return (r?.role as RsvpRole) ?? null;
}

async function joinPolicyOf(orgId: string): Promise<OrgJoinPolicy> {
  if (!(await schemaHas('organizations', 'join_policy'))) return 'open';
  const [r] = await db<Array<{ join_policy: string }>>`SELECT join_policy FROM organizations WHERE id = ${orgId}`;
  const v = r?.join_policy;
  return v === 'invite_only' || v === 'private' ? v : 'open';
}

// ------------------------------------------------------------- core: join / leave

export interface JoinOptions {
  /** null = no org filter (the network subdomain route). */
  orgId: string | null;
  visibility?: 'any' | 'public-only';
  /** Default true: a full thread writes `waitlist`. */
  waitlist?: boolean;
  /** 'refuse' = priced threads answer 402; 'checkout' = the caller starts payment. */
  paid?: 'refuse' | 'checkout';
  followOnRsvp?: boolean;
}

export type JoinResult =
  | { kind: 'not_found' }
  | { kind: 'refused'; httpStatus: number; error: string; thread: RsvpThread }
  | { kind: 'needs_checkout'; thread: RsvpThread; previous: RsvpStatusValue | null }
  | {
      kind: 'joined' | 'waitlisted';
      thread: RsvpThread;
      previous: RsvpStatusValue | null;
      status: 'yes' | 'waitlist';
      count: number;
    };

/**
 * Join a thread's RSVP as `yes`, under a lock on the thread row. Pure rules in
 * `decideRsvp`; this reads the facts and writes the row. Does not send mail.
 */
export async function joinThreadRsvp(
  threadId: string,
  userId: string,
  opts: JoinOptions,
  viewerRole?: RsvpRole
): Promise<JoinResult> {
  const peek = await loadThread(db, threadId, opts);
  if (!peek) return { kind: 'not_found' };

  // Following first: a refusal must leave no seat behind.
  const role = viewerRole === undefined ? await roleOf(userId, peek.org_id) : viewerRole;
  const follow = followDecision({
    followOnRsvp: Boolean(opts.followOnRsvp),
    role,
    joinPolicy: opts.followOnRsvp && !role ? await joinPolicyOf(peek.org_id) : 'open',
  });
  if (follow.action === 'refuse') return { kind: 'refused', httpStatus: 403, error: follow.error, thread: peek };

  const holds = await holdColumns();
  const result = await db.begin(async (tx) => {
    const q = tx as unknown as Q;
    const thread = await loadThread(q, threadId, { ...opts, lock: true });
    if (!thread) return { kind: 'not_found' } as JoinResult;
    const [prev] = await q<Array<{ status: RsvpStatusValue }>>`
      SELECT status FROM thread_rsvps WHERE thread_id = ${threadId} AND user_id = ${userId}
    `;
    const previous = prev?.status ?? null;
    const taken = await seatsTaken(q, threadId, userId);
    const decision = decideRsvp({
      thread: {
        isRsvpEnabled: thread.is_rsvp_enabled,
        deadline: thread.rsvp_deadline,
        attendeeLimit: thread.attendee_limit,
        priceMinor: toMinor(thread.price),
      },
      now: new Date(),
      seatsTaken: taken,
      previous,
      paid: opts.paid ?? 'refuse',
      waitlist: opts.waitlist,
    });

    if (decision.action === 'refuse') {
      return { kind: 'refused', httpStatus: decision.httpStatus, error: decision.error, thread } as JoinResult;
    }
    if (decision.action === 'checkout') return { kind: 'needs_checkout', thread, previous } as JoinResult;

    if (decision.action === 'already' && decision.status === 'waitlist') {
      return { kind: 'waitlisted', thread, previous, status: 'waitlist', count: await countYes(q, threadId) } as JoinResult;
    }
    if (decision.action === 'waitlist') {
      await q`
        INSERT INTO thread_rsvps (thread_id, user_id, status)
        VALUES (${threadId}, ${userId}, 'waitlist')
        ON CONFLICT (thread_id, user_id)
        DO UPDATE SET status = 'waitlist', updated_at = NOW()
      `;
      return { kind: 'waitlisted', thread, previous, status: 'waitlist', count: await countYes(q, threadId) } as JoinResult;
    }

    // confirm, or already-yes (the write refreshes updated_at so a recurring
    // gathering's new cycle counts them again)
    if (holds) {
      await q`
        INSERT INTO thread_rsvps (thread_id, user_id, status)
        VALUES (${threadId}, ${userId}, 'yes')
        ON CONFLICT (thread_id, user_id)
        DO UPDATE SET status = 'yes', updated_at = NOW(), hold_expires_at = NULL
      `;
    } else {
      await q`
        INSERT INTO thread_rsvps (thread_id, user_id, status)
        VALUES (${threadId}, ${userId}, 'yes')
        ON CONFLICT (thread_id, user_id)
        DO UPDATE SET status = 'yes', updated_at = NOW()
      `;
    }
    return { kind: 'joined', thread, previous, status: 'yes', count: await countYes(q, threadId) } as JoinResult;
  });

  if ((result.kind === 'joined' || result.kind === 'waitlisted') && follow.action === 'follow' && result.previous !== 'yes') {
    // A viewer row, never a role change; never a contacts (mail) row.
    await db`
      INSERT INTO user_organizations (user_id, org_id, role, joined_at)
      VALUES (${userId}, ${result.thread.org_id}, 'viewer', NOW())
      ON CONFLICT (user_id, org_id) DO NOTHING
    `.catch((err) => console.error('[rsvp] follow-on-rsvp:', err));
  }
  return result;
}

export interface LeaveResult {
  kind: 'not_found' | 'left';
  thread?: RsvpThread;
  previous?: RsvpStatusValue | null;
  count?: number;
  promoted?: number;
  refundDue?: boolean;
}

/**
 * Cancel: delete the row, record a refund as due for a paid place, promote the
 * oldest waitlisted person. The refund is only recorded here; one press
 * (`issueRsvpRefund`) issues it.
 */
export async function leaveThreadRsvp(
  threadId: string,
  userId: string,
  opts: { orgId: string | null; visibility?: 'any' | 'public-only'; origin?: string; orgName?: string; holdHours?: number }
): Promise<LeaveResult> {
  const result = await db.begin(async (tx) => {
    const q = tx as unknown as Q;
    const thread = await loadThread(q, threadId, { ...opts, lock: true });
    if (!thread) return { kind: 'not_found' } as LeaveResult;
    const [prev] = await q<Array<{ status: RsvpStatusValue }>>`
      SELECT status FROM thread_rsvps WHERE thread_id = ${threadId} AND user_id = ${userId}
    `;
    await q`DELETE FROM thread_rsvps WHERE thread_id = ${threadId} AND user_id = ${userId}`;
    let refundDue = false;
    if (prev?.status === 'yes') refundDue = await recordRefundDue(q, thread, userId);
    return { kind: 'left', thread, previous: prev?.status ?? null, refundDue } as LeaveResult;
  });
  if (result.kind !== 'left' || !result.thread) return result;
  const promoted = await promoteWaitlist(threadId, {
    origin: opts.origin,
    orgName: opts.orgName,
    holdHours: opts.holdHours,
  });
  return { ...result, promoted: promoted.length, count: await countYes(db, threadId) };
}

// ---------------------------------------------------------------- waitlist

export interface PromotedPerson {
  userId: string;
  mode: 'seat' | 'hold';
}

/**
 * Fill open seats from the waitlist, oldest first. A free thread moves the
 * person straight to `yes` and emails them. A priced thread gives them a hold
 * (migration 278: hold_expires_at) and emails a pay link; without the column
 * a priced thread is left alone rather than promised a hold it cannot keep.
 * Lapsed holds go back to the end of the line first.
 */
export async function promoteWaitlist(
  threadId: string,
  opts: { origin?: string; orgName?: string; holdHours?: number } = {}
): Promise<PromotedPerson[]> {
  const holds = await holdColumns();
  if (holds) {
    await db`
      UPDATE thread_rsvps SET hold_expires_at = NULL, promoted_at = NULL, updated_at = NOW()
      WHERE thread_id = ${threadId} AND status = 'waitlist' AND hold_expires_at IS NOT NULL AND hold_expires_at <= NOW()
    `.catch((err) => console.error('[rsvp] lapse holds:', err));
  }

  const done = await db.begin(async (tx) => {
    const q = tx as unknown as Q;
    const thread = await loadThread(q, threadId, { orgId: null, lock: true });
    if (!thread || !thread.is_rsvp_enabled) return null;
    const priced = toMinor(thread.price) > 0;
    if (priced && !holds) return null;
    const taken = await seatsTaken(q, threadId, null);
    const free = seatsFree(thread.attendee_limit, taken);
    if (free <= 0) return null;
    const queue = await q<Array<{ user_id: string; updated_at: Date; hold_expires_at: Date | null }>>`
      SELECT user_id, updated_at, ${holds ? q`hold_expires_at` : q`NULL::timestamptz AS hold_expires_at`}
      FROM thread_rsvps WHERE thread_id = ${threadId} AND status = 'waitlist'
    `;
    const picks = pickPromotions({
      free: Number.isFinite(free) ? free : queue.length,
      queue: queue.map((r) => ({ userId: r.user_id, queuedAt: r.updated_at, holdExpiresAt: r.hold_expires_at })),
      now: new Date(),
      priced,
      holdHours: opts.holdHours,
    });
    for (const p of picks) {
      if (p.mode === 'seat') {
        await q`UPDATE thread_rsvps SET status = 'yes', updated_at = NOW() WHERE thread_id = ${threadId} AND user_id = ${p.userId}`;
      } else {
        await q`
          UPDATE thread_rsvps SET hold_expires_at = ${p.holdExpiresAt}, promoted_at = NOW()
          WHERE thread_id = ${threadId} AND user_id = ${p.userId}
        `;
      }
    }
    return { thread, picks };
  });
  if (!done || done.picks.length === 0) return [];

  const origin = (opts.origin ?? defaultOrigin()).replace(/\/$/, '');
  const url = threadUrl(origin, done.thread);
  for (const p of done.picks) {
    const [u] = await db<Array<{ email: string }>>`SELECT email FROM users WHERE id = ${p.userId}`;
    if (!u?.email) continue;
    const hours = opts.holdHours ?? 24;
    await sendMail({
      to: u.email,
      orgId: done.thread.org_id,
      threadId: done.thread.id,
      subject: `A place opened: ${done.thread.title}`,
      html: mailBody(
        p.mode === 'seat'
          ? [`A place opened at <strong>${esc(done.thread.title)}</strong> and it is yours.`, button(url, 'See the details')]
          : [
              `A place opened at <strong>${esc(done.thread.title)}</strong>. It is held for you for ${hours} hours; pay to keep it.`,
              button(url, 'Pay and keep my place'),
              'If the hold runs out, the place goes to the next person in line.',
            ]
      ),
    });
  }
  return done.picks.map((p) => ({ userId: p.userId, mode: p.mode }));
}

/** For a sweeper or tick: lapse every expired hold and promote the next person on each thread. */
export async function expireLapsedRsvpHolds(): Promise<number> {
  if (!(await holdColumns())) return 0;
  const rows = await db<Array<{ thread_id: string }>>`
    UPDATE thread_rsvps SET hold_expires_at = NULL, promoted_at = NULL, updated_at = NOW()
    WHERE status = 'waitlist' AND hold_expires_at IS NOT NULL AND hold_expires_at <= NOW()
    RETURNING thread_id
  `;
  const threads = [...new Set(rows.map((r) => r.thread_id))];
  for (const id of threads) await promoteWaitlist(id);
  return rows.length;
}

// ------------------------------------------------------------------ refunds

async function recordRefundDue(q: Q, thread: RsvpThread, userId: string): Promise<boolean> {
  if (!(await schemaHas('rsvp_refund_due'))) return false;
  const [order] = await q<Array<{ id: string; total_minor: string | number }>>`
    SELECT o.id, o.total_minor
    FROM commerce_order o
    JOIN commerce_order_line l ON l.order_id = o.id
    WHERE l.thread_id = ${thread.id} AND o.customer_id = ${userId}
      AND o.status IN ('paid', 'fulfilled', 'completed')
    ORDER BY o.created_at DESC
    LIMIT 1
  `;
  const plan = refundOnCancel({ hadPaidOrder: Boolean(order), paidMinor: Number(order?.total_minor ?? 0) });
  if (!plan.record) return false;
  await q`
    INSERT INTO rsvp_refund_due (order_id, thread_id, user_id, org_id, amount_minor, status)
    VALUES (${order.id}, ${thread.id}, ${userId}, ${thread.org_id}, ${plan.amountMinor}, 'due')
    ON CONFLICT (order_id) DO NOTHING
  `;
  return true;
}

export interface RefundDue {
  orderId: string;
  threadId: string;
  threadTitle: string;
  userId: string;
  email: string | null;
  amountMinor: number;
  status: 'due' | 'issued' | 'declined';
  createdAt: Date;
}

/** Refunds a host still has to press, newest first. Empty before migration 278. */
export async function listRsvpRefundsDue(orgId: string): Promise<RefundDue[]> {
  if (!(await schemaHas('rsvp_refund_due'))) return [];
  const rows = await db<
    Array<{ order_id: string; thread_id: string; title: string; user_id: string; email: string | null; amount_minor: string | number; status: RefundDue['status']; created_at: Date }>
  >`
    SELECT r.order_id, r.thread_id, t.title, r.user_id, u.email, r.amount_minor, r.status, r.created_at
    FROM rsvp_refund_due r
    JOIN threads t ON t.id = r.thread_id
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.org_id = ${orgId} AND r.status = 'due'
    ORDER BY r.created_at DESC
  `;
  return rows.map((r) => ({
    orderId: r.order_id,
    threadId: r.thread_id,
    threadTitle: r.title,
    userId: r.user_id,
    email: r.email,
    amountMinor: Number(r.amount_minor),
    status: r.status,
    createdAt: r.created_at,
  }));
}

/**
 * The one press. `refunder` moves the money (the app passes `refundStripeOrder`
 * from @elkdonis/checkout/stripe; this package does not depend on checkout) and
 * throws when it cannot. The row only turns `issued` after it returns.
 */
export async function issueRsvpRefund(input: {
  orderId: string;
  actorUserId: string;
  refunder: (a: { orderId: string; actorUserId: string; reason: string }) => Promise<unknown>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await schemaHas('rsvp_refund_due'))) return { ok: false, error: 'Refund records are not set up yet.' };
  const [row] = await db<Array<{ status: string; thread_id: string }>>`
    SELECT status, thread_id FROM rsvp_refund_due WHERE order_id = ${input.orderId}
  `;
  if (!row) return { ok: false, error: 'No refund is due on that order.' };
  if (row.status !== 'due') return { ok: false, error: `That refund is already ${row.status}.` };
  try {
    await input.refunder({ orderId: input.orderId, actorUserId: input.actorUserId, reason: 'RSVP cancelled' });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'The refund could not be issued.' };
  }
  await db`
    UPDATE rsvp_refund_due SET status = 'issued', issued_at = NOW(), issued_by = ${input.actorUserId}
    WHERE order_id = ${input.orderId} AND status = 'due'
  `;
  return { ok: true };
}

// ---------------------------------------------------------------- attended

/**
 * Record that a person attended. Workshops and events only: a standing meeting
 * has no "attended" (decision 3e). The actor must be the thread's author or an
 * owner or guide of its org. Needs migration 278 (thread_rsvps.attended_at).
 */
export async function markAttended(input: {
  threadId: string;
  userId: string;
  actorUserId: string;
  attended?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string; httpStatus: number }> {
  const thread = await loadThread(db, input.threadId, { orgId: null });
  if (!thread) return { ok: false, error: 'Not found', httpStatus: 404 };
  if (!attendedAllowed(thread.kind)) {
    return { ok: false, error: 'Attendance is recorded for workshops and events only.', httpStatus: 409 };
  }
  const actorRole = await roleOf(input.actorUserId, thread.org_id);
  if (thread.author_id !== input.actorUserId && actorRole !== 'owner' && actorRole !== 'guide') {
    return { ok: false, error: 'Only the host can record attendance.', httpStatus: 403 };
  }
  if (!(await schemaHas('thread_rsvps', 'attended_at'))) {
    return { ok: false, error: 'Attendance records are not set up yet.', httpStatus: 503 };
  }
  const on = input.attended !== false;
  const rows = await db`
    UPDATE thread_rsvps
    SET attended_at = ${on ? new Date() : null}, attended_by = ${on ? input.actorUserId : null}
    WHERE thread_id = ${input.threadId} AND user_id = ${input.userId} AND status = 'yes'
    RETURNING user_id
  `;
  if (rows.length === 0) return { ok: false, error: 'That person has no confirmed place.', httpStatus: 404 };
  return { ok: true };
}

// ------------------------------------------------- attendance (standing meeting)

/**
 * The seat check the "will you make it" attendance doors share. They keep their
 * own write (flavour, promise_next); this gives them the same rules as RSVP:
 * the price refusal and the capacity count including holds and verified guests.
 * Not lock-safe by itself (the write is theirs).
 */
export async function checkAttendanceSeat(
  threadId: string,
  userId: string,
  opts: { orgId: string | null }
): Promise<{ ok: true } | { ok: false; error: string; httpStatus: number }> {
  const thread = await loadThread(db, threadId, opts);
  if (!thread) return { ok: false, error: 'Not found', httpStatus: 404 };
  const [prev] = await db<Array<{ status: RsvpStatusValue }>>`
    SELECT status FROM thread_rsvps WHERE thread_id = ${threadId} AND user_id = ${userId}
  `;
  const decision = decideRsvp({
    thread: {
      isRsvpEnabled: thread.is_rsvp_enabled,
      deadline: thread.rsvp_deadline,
      attendeeLimit: thread.attendee_limit,
      priceMinor: toMinor(thread.price),
    },
    now: new Date(),
    seatsTaken: await seatsTaken(db, threadId, userId),
    previous: prev?.status ?? null,
    paid: 'refuse',
    waitlist: false,
  });
  if (decision.action === 'refuse') return { ok: false, error: decision.error, httpStatus: decision.httpStatus };
  return { ok: true };
}

// ------------------------------------------------------- member route factory

export interface RsvpViewer {
  userId: string;
  email: string;
  /** Role in the thread's org when the app knows it; the handler looks it up otherwise. */
  role?: RsvpRole;
}

export interface PaidContext {
  request: Request;
  thread: RsvpThread;
  viewer: RsvpViewer;
  body: Record<string, unknown>;
  previous: RsvpStatusValue | null;
}

export interface RsvpEmails {
  /** Confirmation to the person (default true). */
  confirmation?: boolean;
  /** Notification to the thread's author or the fallback (default true). */
  owner?: boolean;
  fallbackNotifyEmail?: string;
  emblemUrl?: string;
  emblemAlt?: string;
  /** Extra links, body text and media for the confirmation (templates, materials). */
  confirmationExtras?: (threadId: string) => Promise<Partial<Pick<Parameters<typeof sendRsvpConfirmation>[1], 'bodyText' | 'links' | 'media'>>>;
}

export type RsvpResponseShape = 'attending' | 'ok-count' | 'ok-status';

export interface RsvpRouteOptions {
  /** The site's org, or null for the network route that serves any org's threads. */
  orgId: string | null;
  orgName: string;
  who: () => Promise<RsvpViewer | null>;
  /** Each app keeps the JSON its page already reads. */
  shape: RsvpResponseShape;
  visibility?: 'any' | 'public-only';
  waitlist?: boolean;
  /** Default 'refuse' (402). A function starts checkout and returns the app's response. */
  paid?: 'refuse' | ((ctx: PaidContext) => Promise<Response>);
  followOnRsvp?: boolean;
  /** false or omitted = no mail from this door. */
  emails?: RsvpEmails | false;
  /** Request origin for links in mail; default the request's own. */
  origin?: (request: Request) => string;
  signInMessage?: string;
  onJoined?: (ctx: { thread: RsvpThread; userId: string }) => void | Promise<void>;
  onLeft?: (ctx: { thread: RsvpThread; userId: string }) => void | Promise<void>;
  /** Log prefix, e.g. "sunjay". */
  label: string;
  holdHours?: number;
}

type Ctx = { params: Promise<{ id: string }> };

export function rsvpRoutes(opts: RsvpRouteOptions) {
  const signIn = opts.signInMessage ?? 'Sign in to RSVP';
  const originOf = (request: Request) => (opts.origin ? opts.origin(request) : requestOrigin(request));

  function joinedBody(
    status: 'yes' | 'waitlist',
    count: number,
    minAttendeesReached: boolean
  ): Record<string, unknown> {
    const waitlisted = status === 'waitlist';
    if (opts.shape === 'ok-status') return { ok: true, status, ...(waitlisted ? { waitlisted: true } : {}) };
    if (opts.shape === 'ok-count') return { ok: true, count, ...(waitlisted ? { waitlisted: true, status } : {}) };
    return waitlisted
      ? { attending: false, waitlisted: true, status, count, minAttendeesReached: false }
      : { attending: true, count, minAttendeesReached };
  }

  async function GET(_request: Request, ctx: Ctx) {
    const { id } = await ctx.params;
    const viewer = await opts.who();
    if (!viewer) return Response.json({ attending: false, status: null });
    const thread = await loadThread(db, id, opts);
    if (!thread) return Response.json({ error: 'Not found' }, { status: 404 });
    const [row] = await db<Array<{ status: string; updated_at: Date }>>`
      SELECT status, updated_at FROM thread_rsvps WHERE thread_id = ${id} AND user_id = ${viewer.userId}
    `;
    if (!row) return Response.json({ attending: false, status: null });
    // A recurring gathering's RSVP expires with its cycle: someone who came
    // last month is asked again rather than counted as attending forever.
    const current =
      !thread.scheduled_at ||
      isWithinCurrentCycle(row.updated_at, thread.scheduled_at, thread.recurrence_pattern, thread.duration_minutes);
    return Response.json({
      attending: current && row.status === 'yes',
      status: current ? row.status : null,
      registeredAt: row.updated_at,
    });
  }

  async function POST(request: Request, ctx: Ctx) {
    const { id } = await ctx.params;
    const viewer = await opts.who();
    if (!viewer) return Response.json({ error: opts.signInMessage ?? signIn }, { status: 401 });

    const body = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    const receiveEmailNotice = body.receiveEmailNotice !== false;

    const joined = await joinThreadRsvp(
      id,
      viewer.userId,
      {
        orgId: opts.orgId,
        visibility: opts.visibility,
        waitlist: opts.waitlist,
        paid: typeof opts.paid === 'function' ? 'checkout' : 'refuse',
        followOnRsvp: opts.followOnRsvp,
      },
      viewer.role
    );

    if (joined.kind === 'not_found') return Response.json({ error: 'Not found' }, { status: 404 });
    if (joined.kind === 'refused') return Response.json({ error: joined.error }, { status: joined.httpStatus });
    if (joined.kind === 'needs_checkout') {
      if (typeof opts.paid !== 'function') return Response.json({ error: 'This one is paid.' }, { status: 402 });
      return opts.paid({ request, thread: joined.thread, viewer, body, previous: joined.previous });
    }

    const { thread, previous, count, status } = joined;
    const origin = originOf(request);

    if (status === 'waitlist') {
      if (previous !== 'waitlist') {
        void sendMail({
          to: viewer.email,
          orgId: thread.org_id,
          threadId: thread.id,
          subject: `On the waitlist: ${thread.title}`,
          html: mailBody([
            `<strong>${esc(thread.title)}</strong> is full, so you are on the waitlist.`,
            'If a place opens you will get an email straight away.',
          ]),
        });
      }
      return Response.json(joinedBody('waitlist', count, false));
    }

    // One-shot: guarded by min_attendees_notified so a gathering that hovers at
    // the threshold does not email the guide on every RSVP.
    const minAttendeesReached =
      thread.notify_on_min_attendees &&
      !thread.min_attendees_notified &&
      thread.min_attendees !== null &&
      count >= thread.min_attendees;
    if (minAttendeesReached) await db`UPDATE threads SET min_attendees_notified = TRUE WHERE id = ${id}`;

    if (opts.onJoined) {
      try {
        await opts.onJoined({ thread, userId: viewer.userId });
      } catch (err) {
        console.warn(`[${opts.label}] rsvp onJoined hook failed for ${id}:`, err);
      }
    }

    const emails = opts.emails || null;
    if (emails) {
      // Fire-and-forget: a delivery failure never costs someone their RSVP.
      void (async () => {
        const scheduledAt = thread.scheduled_at?.toISOString();
        try {
          if (emails.confirmation !== false && receiveEmailNotice && previous !== 'yes') {
            const extras = emails.confirmationExtras ? await emails.confirmationExtras(id).catch(() => ({})) : {};
            await sendRsvpConfirmation(viewer.email, {
              guestName: viewer.email.split('@')[0],
              meetingTitle: thread.title,
              section: thread.section ?? undefined,
              scheduledAt,
              location: thread.location ?? undefined,
              meetingUrl: thread.meeting_url ?? undefined,
              orgId: opts.orgId ?? thread.org_id,
              orgName: opts.orgName,
              ...(emails.emblemUrl ? { dark: false, emblemUrl: emails.emblemUrl, emblemAlt: emails.emblemAlt } : {}),
              ...extras,
            });
          }
        } catch (err) {
          console.error(`[${opts.label}] rsvp confirmation email:`, err);
        }
        // Guest and owner emails are configured separately on purpose: the
        // author's own copy must not leak into the notification they receive.
        const notifyTo = thread.author_email ?? emails.fallbackNotifyEmail;
        try {
          if (emails.owner !== false && notifyTo && previous !== 'yes') {
            await sendRsvpNotification(notifyTo, {
              guestName: viewer.email,
              guestEmail: viewer.email,
              meetingTitle: thread.title,
              section: thread.section ?? undefined,
              scheduledAt,
              threadUrl: threadUrl(origin, thread),
              orgId: opts.orgId ?? thread.org_id,
              orgName: opts.orgName,
              rsvpCount: count,
            });
          }
          if (emails.owner !== false && minAttendeesReached && notifyTo) {
            await sendRsvpNotification(notifyTo, {
              guestName: viewer.email,
              meetingTitle: thread.title,
              section: thread.section ?? undefined,
              scheduledAt,
              threadUrl: threadUrl(origin, thread),
              orgId: opts.orgId ?? thread.org_id,
              orgName: opts.orgName,
              rsvpCount: count,
              guestMessage: `Minimum attendees threshold of ${thread.min_attendees} has been reached.`,
            });
          }
        } catch (err) {
          console.error(`[${opts.label}] rsvp owner notification:`, err);
        }
      })();
    }

    return Response.json(joinedBody('yes', count, minAttendeesReached));
  }

  async function DELETE(request: Request, ctx: Ctx) {
    const { id } = await ctx.params;
    const viewer = await opts.who();
    if (!viewer) return Response.json({ error: 'Sign in first' }, { status: 401 });

    const left = await leaveThreadRsvp(id, viewer.userId, {
      orgId: opts.orgId,
      visibility: opts.visibility,
      origin: originOf(request),
      orgName: opts.orgName,
      holdHours: opts.holdHours,
    });
    if (left.kind === 'not_found' || !left.thread) return Response.json({ error: 'Not found' }, { status: 404 });
    if (opts.onLeft) {
      try {
        await opts.onLeft({ thread: left.thread, userId: viewer.userId });
      } catch (err) {
        console.warn(`[${opts.label}] rsvp onLeft hook failed for ${id}:`, err);
      }
    }
    if (opts.shape === 'ok-count') return Response.json({ ok: true, count: left.count ?? 0 });
    if (opts.shape === 'ok-status') return Response.json({ ok: true, status: null });
    return Response.json({ attending: false });
  }

  return { GET, POST, DELETE };
}

// -------------------------------------------------------- guest route factory

export interface GuestRsvpOptions {
  orgId: string;
  orgName: string;
  emails?: RsvpEmails;
  /** Request origin for the verification link; default the request's own. */
  origin?: (request: Request) => string;
  label: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function clientIp(request: Request): string | null {
  const fwd = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = fwd || request.headers.get('x-real-ip') || '';
  return isIP(ip) ? ip : null;
}

/**
 * Guest RSVP, no account. The place counts only after the emailed link is
 * clicked (decision 3a): until then the row is written as kind `interest` with
 * `metadata.pending_rsvp`, so every existing count of `kind = 'rsvp'` leaves it
 * out; the click moves it to `rsvp` and stamps `verified_at`. Verified guests
 * take a seat. The 21 older rows have no verification fields and keep counting
 * as history.
 */
export function guestRsvpRoutes(opts: GuestRsvpOptions) {
  const originOf = (request: Request) => (opts.origin ? opts.origin(request) : requestOrigin(request));

  async function POST(request: Request) {
    try {
      const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!raw) return Response.json({ error: 'Expected JSON' }, { status: 400 });
      // `meeting_id` is the pre-rebuild field name; older embedded forms use it.
      const threadId = typeof (raw.threadId ?? raw.meeting_id) === 'string' ? String(raw.threadId ?? raw.meeting_id) : '';
      const input = cleanGuestInput(raw);
      if (!threadId) return Response.json({ error: 'A name and the gathering are required.' }, { status: 400 });
      if (input.ok === false) return Response.json({ error: input.error }, { status: 400 });
      const wantsReminder = Boolean(raw.wantsReminder ?? raw.wants_reminder ?? false);

      const thread = await loadThread(db, threadId, { orgId: opts.orgId });
      if (!thread) return Response.json({ error: 'Not found' }, { status: 404 });
      if (!thread.is_rsvp_enabled) return Response.json({ error: 'RSVPs are not open for this.' }, { status: 409 });
      if (thread.rsvp_deadline && new Date(thread.rsvp_deadline) < new Date()) {
        return Response.json({ error: 'The RSVP deadline has passed.' }, { status: 409 });
      }
      if (toMinor(thread.price) > 0) {
        return Response.json({ error: 'This one is paid, so please sign in to book a place.' }, { status: 409 });
      }

      const ip = clientIp(request);
      const [byEmail] = await db<Array<{ n: number }>>`
        SELECT COUNT(*)::int AS n FROM guest_submissions
        WHERE kind IN ('rsvp', 'interest') AND lower(email) = ${input.email} AND created_at > NOW() - INTERVAL '1 hour'
      `;
      const [byIp] = ip
        ? await db<Array<{ n: number }>>`
            SELECT COUNT(*)::int AS n FROM guest_submissions
            WHERE kind IN ('rsvp', 'interest') AND ip_address = ${ip}::inet AND created_at > NOW() - INTERVAL '1 hour'
          `
        : [{ n: 0 }];
      if (guestRateLimited({ sameEmailLastHour: byEmail?.n ?? 0, sameIpLastHour: byIp?.n ?? 0 })) {
        return Response.json({ error: 'Too many tries. Please wait a while and try again.' }, { status: 429 });
      }

      const full =
        thread.attendee_limit != null &&
        thread.attendee_limit > 0 &&
        (await seatsTaken(db, thread.id, null)) >= thread.attendee_limit;
      if (full) return Response.json({ error: 'This is at capacity.' }, { status: 409 });

      const [existing] = await db<Array<{ id: string; kind: string }>>`
        SELECT id, kind FROM guest_submissions
        WHERE thread_id = ${thread.id} AND lower(email) = ${input.email} AND kind IN ('rsvp', 'interest')
          AND (kind = 'rsvp' OR metadata->>'pending_rsvp' = 'true')
        ORDER BY created_at DESC LIMIT 1
      `;
      const count = (await countGuestsAndMembers(thread.id)).guests;
      if (existing?.kind === 'rsvp') {
        return Response.json({ ok: true, rsvpCount: count, alreadyConfirmed: true });
      }

      const token = randomBytes(24).toString('base64url');
      const verifyExpiresAt = new Date(Date.now() + GUEST_VERIFY_HOURS * 3600_000).toISOString();
      const meta = {
        phone: input.phone || null,
        wants_reminder: wantsReminder,
        newsletter_opt_in: input.newsletterOptIn,
        pending_rsvp: true,
        verify_hash: hashToken(token),
        verify_expires_at: verifyExpiresAt,
        verified_at: null,
      };
      if (existing) {
        await db`UPDATE guest_submissions SET metadata = ${db.json(meta)}, name = ${input.name}, message = ${input.message || null}, created_at = NOW() WHERE id = ${existing.id}`;
      } else {
        await db`
          INSERT INTO guest_submissions (id, thread_id, kind, name, email, message, metadata, ip_address, user_agent)
          VALUES (
            ${nanoid()}, ${thread.id}, 'interest', ${input.name}, ${input.email}, ${input.message || null},
            ${db.json(meta)}, ${ip}::inet, ${request.headers.get('user-agent')?.slice(0, 300) ?? null}
          )
        `;
      }

      const link = `${originOf(request)}/api/rsvp?verify=${encodeURIComponent(token)}`;
      // The one message an unverified address gets.
      void sendMail({
        to: input.email,
        orgId: opts.orgId,
        threadId: thread.id,
        subject: `Confirm your place: ${thread.title}`,
        html: mailBody([
          `Hello ${esc(input.name)}, please confirm your place at <strong>${esc(thread.title)}</strong>.`,
          button(link, 'Confirm my place'),
          `The link works for ${GUEST_VERIFY_HOURS} hours. If this was not you, ignore this email and nothing happens.`,
        ]),
      });

      return Response.json({ ok: true, rsvpCount: count, needsVerification: true });
    } catch (err) {
      console.error(`[${opts.label}] POST /api/rsvp:`, err);
      return Response.json({ error: 'Something went wrong.' }, { status: 500 });
    }
  }

  /** The emailed link: GET /api/rsvp?verify=<token>. Redirects back to the thread page. */
  async function GET(request: Request) {
    const url = new URL(request.url);
    const token = url.searchParams.get('verify') ?? '';
    const origin = originOf(request);
    const back = (t: { section: string | null; slug: string } | null, flag: string) =>
      Response.redirect(`${t ? threadUrl(origin, t) : origin}?rsvp=${flag}`, 303);
    if (!token) return Response.json({ error: 'Not found' }, { status: 404 });

    try {
      const [row] = await db<
        Array<{ id: string; thread_id: string; name: string | null; email: string | null; message: string | null; metadata: Record<string, unknown> }>
      >`
        SELECT id, thread_id, name, email, message, metadata FROM guest_submissions
        WHERE kind IN ('interest', 'rsvp') AND metadata->>'verify_hash' = ${hashToken(token)}
        LIMIT 1
      `;
      if (!row || !row.thread_id) return back(null, 'invalid');
      const thread = await loadThread(db, row.thread_id, { orgId: opts.orgId });
      if (!thread) return back(null, 'invalid');
      const m = row.metadata as Record<string, unknown>;
      const state = guestRsvpState(
        {
          verifyHash: String(m.verify_hash ?? ''),
          verifyExpiresAt: (m.verify_expires_at as string) ?? null,
          verifiedAt: (m.verified_at as string) ?? null,
        },
        new Date()
      );
      if (state === 'verified') return back(thread, 'confirmed');
      if (state === 'expired') return back(thread, 'expired');

      const confirmed = await db.begin(async (tx) => {
        const q = tx as unknown as Q;
        const locked = await loadThread(q, thread.id, { orgId: opts.orgId, lock: true });
        if (!locked) return 'invalid' as const;
        if (locked.attendee_limit && (await seatsTaken(q, thread.id, null)) >= locked.attendee_limit) return 'full' as const;
        await q`
          UPDATE guest_submissions
          SET kind = 'rsvp',
              metadata = metadata || ${q.json({ pending_rsvp: false, verified_at: new Date().toISOString() })}
          WHERE id = ${row.id}
        `;
        return 'ok' as const;
      });
      if (confirmed !== 'ok') return back(thread, confirmed);

      // Newsletter mail has its own opt-in: a contacts row only when they asked.
      if (m.newsletter_opt_in === true && row.email) {
        await db`
          INSERT INTO contacts (id, org_id, email, name, message, status, source)
          VALUES (${nanoid()}, ${opts.orgId}, ${row.email}, ${row.name}, ${row.message}, 'new', 'rsvp')
          ON CONFLICT DO NOTHING
        `.catch((err) => console.error(`[${opts.label}] guest contact:`, err));
      }

      const count = (await countGuestsAndMembers(thread.id)).guests;
      const emails = opts.emails;
      void (async () => {
        const scheduledAt = thread.scheduled_at?.toISOString();
        try {
          if (row.email && emails?.confirmation !== false) {
            await sendRsvpConfirmation(row.email, {
              guestName: row.name ?? row.email,
              meetingTitle: thread.title,
              section: thread.section ?? undefined,
              scheduledAt,
              orgId: opts.orgId,
              orgName: opts.orgName,
            });
          }
        } catch (err) {
          console.error(`[${opts.label}] guest confirmation email:`, err);
        }
        try {
          const notifyTo = thread.author_email ?? emails?.fallbackNotifyEmail;
          if (notifyTo && emails?.owner !== false) {
            await sendRsvpNotification(notifyTo, {
              guestName: row.name ?? row.email ?? 'A guest',
              guestEmail: row.email ?? undefined,
              guestPhone: (m.phone as string) || undefined,
              guestMessage: row.message || undefined,
              wantsReminder: Boolean(m.wants_reminder),
              meetingTitle: thread.title,
              section: thread.section ?? undefined,
              scheduledAt,
              threadUrl: threadUrl(origin, thread),
              orgId: opts.orgId,
              orgName: opts.orgName,
              rsvpCount: count,
            });
          }
        } catch (err) {
          console.error(`[${opts.label}] guest owner notification:`, err);
        }
      })();
      return back(thread, 'confirmed');
    } catch (err) {
      console.error(`[${opts.label}] GET /api/rsvp verify:`, err);
      return back(null, 'error');
    }
  }

  return { POST, GET };
}

/** Confirmed members plus counted guests (verified and legacy), the figure a page shows. */
async function countGuestsAndMembers(threadId: string): Promise<{ members: number; guests: number; total: number }> {
  const members = await countYes(db, threadId);
  const [g] = await db<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM guest_submissions WHERE thread_id = ${threadId} AND kind = 'rsvp'
  `;
  const guests = g?.n ?? 0;
  return { members, guests, total: members + guests };
}

export const RSVP_GUEST_LIMITS = { perEmailPerHour: GUEST_PER_EMAIL_PER_HOUR, perIpPerHour: GUEST_PER_IP_PER_HOUR } as const;

/**
 * The origin a browser used, for links in mail. Not `new URL(request.url)`:
 * the apps listen on 0.0.0.0, so that can read `https://0.0.0.0:3015`. The
 * proxy's forwarded headers carry the real host.
 */
function requestOrigin(request: Request): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (host && !host.startsWith('0.0.0.0')) {
    const proto =
      request.headers.get('x-forwarded-proto') ??
      (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
    return `${proto}://${host}`;
  }
  return defaultOrigin();
}
