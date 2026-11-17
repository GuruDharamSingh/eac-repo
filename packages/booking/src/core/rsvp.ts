/**
 * RSVP rules (docs/open/RSVP_BOOKING_ONE_LOGIC_2026-11-16.md, step 1).
 *
 * Pure: no database, no mail, no clock of its own (`now` is passed in). The
 * service in @elkdonis/services (rsvp-handler.ts) reads the rows, asks these
 * functions what to do, then writes. Justin's decisions of 2026-11-16 live
 * here so they can be tested without a database (scripts/check-rsvp.mts).
 */

/** The viewer's role in the thread's org; null when they have none. */
export type RsvpRole = "owner" | "guide" | "member" | "viewer" | null | undefined;

// ---------------------------------------------------------------- member rule

export interface MemberRule {
  read: boolean;
  rsvp: boolean;
  comment: boolean;
  forumPost: boolean;
  /** Publishing under the org's name needs member or above. */
  publishAsOrg: boolean;
  /** An RSVP gives the host member info by design (#42). */
  sharesInfoWithHost: boolean;
}

/**
 * Participants (a signed-in person with any role, or none) read, RSVP, comment
 * and post to the forum. Only member and above publish under the org's name.
 * Signed out: nothing here (guests go through the guest door).
 */
export function memberRule(signedIn: boolean, role: RsvpRole): MemberRule {
  const publishAsOrg = signedIn && (role === "owner" || role === "guide" || role === "member");
  return {
    read: signedIn,
    rsvp: signedIn,
    comment: signedIn,
    forumPost: signedIn,
    publishAsOrg,
    sharesInfoWithHost: signedIn,
  };
}

// ----------------------------------------------------------- the seat decision

export type RsvpStatusValue = "yes" | "no" | "maybe" | "waitlist" | "subscribed";

export interface RsvpThreadFacts {
  isRsvpEnabled: boolean;
  deadline: Date | string | null;
  attendeeLimit: number | null;
  /** Minor units; 0 or null = free. */
  priceMinor: number | null;
}

export type RsvpDecision =
  | { action: "confirm"; status: "yes" }
  | { action: "already"; status: RsvpStatusValue }
  | { action: "waitlist"; status: "waitlist" }
  | { action: "checkout" }
  | { action: "refuse"; httpStatus: number; error: string };

export interface RsvpDecisionInput {
  thread: RsvpThreadFacts;
  now: Date;
  /** Seats taken by others: confirmed yes plus unexpired promotion holds, not counting this person. */
  seatsTaken: number;
  /** This person's current status on the thread, or null. */
  previous: RsvpStatusValue | null;
  /** 'refuse' = a priced thread cannot be joined here; 'checkout' = the app starts a payment. */
  paid: "refuse" | "checkout";
  /** Write `waitlist` when the thread is full (default true). */
  waitlist?: boolean;
}

/**
 * What a "yes" does right now.
 *  - A person already on "yes" stays on it, even on a priced thread (the comp,
 *    decision 3b) and even if the room is now full or the deadline passed.
 *  - Full: the waitlist (decision 3d), or a refusal where the app turned it off.
 *  - Priced: checkout or 402, never a free seat (#44).
 */
export function decideRsvp(input: RsvpDecisionInput): RsvpDecision {
  const { thread, previous } = input;
  if (previous === "yes") return { action: "already", status: "yes" };
  if (!thread.isRsvpEnabled) return { action: "refuse", httpStatus: 409, error: "RSVPs are not open for this" };
  if (thread.deadline && new Date(thread.deadline) < input.now) {
    return { action: "refuse", httpStatus: 409, error: "The RSVP deadline has passed" };
  }
  const full = thread.attendeeLimit != null && thread.attendeeLimit > 0 && input.seatsTaken >= thread.attendeeLimit;
  if (full) {
    if (previous === "waitlist") return { action: "already", status: "waitlist" };
    if (input.waitlist === false) return { action: "refuse", httpStatus: 409, error: "This is at capacity" };
    return { action: "waitlist", status: "waitlist" };
  }
  if ((thread.priceMinor ?? 0) > 0) {
    if (input.paid === "checkout") return { action: "checkout" };
    return { action: "refuse", httpStatus: 402, error: "This one is paid, and joining it by RSVP is not available here." };
  }
  return { action: "confirm", status: "yes" };
}

// ------------------------------------------------------------- guest state

export type GuestRsvpState = "unverified" | "verified" | "expired" | "legacy";

export interface GuestRsvpMeta {
  /** Present on every row written after this change; absent on the 21 older rows. */
  verifyHash?: string | null;
  verifyExpiresAt?: string | null;
  verifiedAt?: string | null;
  /** The row was written as a pending `interest` row and not yet moved to `rsvp`. */
  pending?: boolean;
}

/**
 * A guest RSVP counts only after the email is verified (decision 3a). Rows
 * written before this change carry no verification fields; they are history
 * and keep counting ("legacy").
 */
export function guestRsvpState(meta: GuestRsvpMeta, now: Date): GuestRsvpState {
  if (meta.verifiedAt) return "verified";
  if (!meta.verifyHash) return "legacy";
  if (meta.verifyExpiresAt && new Date(meta.verifyExpiresAt) < now) return "expired";
  return "unverified";
}

/** Whether the row takes a seat or is shown in a count. */
export function guestRsvpCounts(state: GuestRsvpState): boolean {
  return state === "verified" || state === "legacy";
}

export const GUEST_NAME_MAX = 120;
export const GUEST_EMAIL_MAX = 254;
export const GUEST_MESSAGE_MAX = 1000;
export const GUEST_PHONE_MAX = 40;
export const GUEST_VERIFY_HOURS = 48;
export const GUEST_PER_EMAIL_PER_HOUR = 3;
export const GUEST_PER_IP_PER_HOUR = 10;

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

export interface GuestInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  message?: unknown;
  newsletterOptIn?: unknown;
}

/** Trim and bound a guest's form. A guest RSVP needs an email now: the link is how it counts. */
export function cleanGuestInput(
  raw: GuestInput
): { ok: true; name: string; email: string; phone: string; message: string; newsletterOptIn: boolean } | { ok: false; error: string } {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(raw.name);
  const email = str(raw.email).toLowerCase();
  const phone = str(raw.phone);
  const message = str(raw.message);
  if (!name) return { ok: false, error: "A name and the gathering are required." };
  if (name.length > GUEST_NAME_MAX) return { ok: false, error: "That name is too long." };
  if (!email) return { ok: false, error: "An email address is needed to confirm your place." };
  if (email.length > GUEST_EMAIL_MAX || !EMAIL_RE.test(email)) return { ok: false, error: "That email address does not look right." };
  if (phone.length > GUEST_PHONE_MAX) return { ok: false, error: "That phone number is too long." };
  if (message.length > GUEST_MESSAGE_MAX) return { ok: false, error: "That message is too long." };
  return { ok: true, name, email, phone, message, newsletterOptIn: raw.newsletterOptIn === true };
}

/** Rate limits over the last hour; the caller counts the rows. */
export function guestRateLimited(counts: { sameEmailLastHour: number; sameIpLastHour: number }): boolean {
  return counts.sameEmailLastHour >= GUEST_PER_EMAIL_PER_HOUR || counts.sameIpLastHour >= GUEST_PER_IP_PER_HOUR;
}

// ------------------------------------------------------------- following

export type OrgJoinPolicy = "open" | "invite_only" | "private";

export type FollowDecision =
  | { action: "none"; subscribeToMail: false }
  | { action: "follow"; subscribeToMail: false }
  | { action: "refuse"; subscribeToMail: false; error: string };

/**
 * An RSVP on a site that has turned follow-on-RSVP on makes the person a
 * follower of the org (decision 3c). Never a role change: anyone who already
 * holds a role is left alone. Private and invite-only orgs refuse. Following
 * never subscribes anyone to mail: newsletter mail has its own opt-in, so
 * `subscribeToMail` is false in every branch.
 */
export function followDecision(input: {
  followOnRsvp: boolean;
  role: RsvpRole;
  joinPolicy: OrgJoinPolicy | null | undefined;
}): FollowDecision {
  if (!input.followOnRsvp) return { action: "none", subscribeToMail: false };
  if (input.role) return { action: "none", subscribeToMail: false };
  const policy = input.joinPolicy ?? "open";
  if (policy !== "open") {
    return { action: "refuse", subscribeToMail: false, error: "This is by invitation, so it cannot be joined by RSVP." };
  }
  return { action: "follow", subscribeToMail: false };
}

// ------------------------------------------------------------- waitlist

export interface WaitlistEntry {
  userId: string;
  /** When they joined the queue (the row's updated_at). */
  queuedAt: Date | string;
  /** An unexpired promotion hold, if they already have one. */
  holdExpiresAt?: Date | string | null;
}

export interface Promotion {
  userId: string;
  /** Free thread: straight to yes. Priced: a hold and a pay link. */
  mode: "seat" | "hold";
  holdExpiresAt: Date | null;
}

export const WAITLIST_HOLD_HOURS = 24;

/**
 * Oldest first. Entries that already hold an unexpired seat are not promoted
 * again (they count as taken). `free` is the number of open seats.
 */
export function pickPromotions(input: {
  free: number;
  queue: WaitlistEntry[];
  now: Date;
  priced: boolean;
  holdHours?: number;
}): Promotion[] {
  const ordered = [...input.queue]
    .filter((e) => !(e.holdExpiresAt && new Date(e.holdExpiresAt) > input.now))
    .sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime() || a.userId.localeCompare(b.userId));
  const hold = new Date(input.now.getTime() + (input.holdHours ?? WAITLIST_HOLD_HOURS) * 3600_000);
  return ordered.slice(0, Math.max(0, input.free)).map((e) => ({
    userId: e.userId,
    mode: input.priced ? "hold" : "seat",
    holdExpiresAt: input.priced ? hold : null,
  }));
}

/** Seats open now: the limit less confirmed yes and unexpired holds. Unlimited returns Infinity. */
export function seatsFree(limit: number | null, seatsTaken: number): number {
  if (limit == null || limit <= 0) return Infinity;
  return Math.max(0, limit - seatsTaken);
}

// ------------------------------------------------------------- attended

/** "Attended" is recorded for workshops and events, not standing meetings (decision 3e). */
export const ATTENDED_KINDS = ["workshop", "event"] as const;

export function attendedAllowed(kind: string | null | undefined): boolean {
  return (ATTENDED_KINDS as readonly string[]).includes(kind ?? "");
}

// ------------------------------------------------------------- refunds

/**
 * Refunds are automatic but triggered by hand (decision): a cancel records the
 * refund as due; one press issues it. Only a paid order creates a due refund,
 * and a person who never paid (the comp) creates none.
 */
export function refundOnCancel(input: {
  hadPaidOrder: boolean;
  paidMinor: number;
}): { record: boolean; amountMinor: number } {
  if (!input.hadPaidOrder || input.paidMinor <= 0) return { record: false, amountMinor: 0 };
  return { record: true, amountMinor: input.paidMinor };
}
