/**
 * Scheduling a booked one-to-one service (migration 174, 2026-09-27).
 *
 * The flow, as proposals passed back and forth:
 *
 *   1. In the booking form the buyer proposes up to three start times. The
 *      app creates the card order (startThreadCheckout), then this row with
 *      `createServiceBooking` — status `awaiting_payment`, nobody is told.
 *   2. `confirmOrderPaid` calls `markServiceBookingPaid`: the row moves to
 *      `awaiting_seller` and both sides get an email. The seller answers on
 *      the network hub (/hub/bookings); the buyer holds a private link
 *      (/bookings/<token>) that needs no account.
 *   3. Whoever is asked either picks one of the open times (→ `confirmed`)
 *      or proposes others (→ the other side is asked). A confirmed booking
 *      can be reopened the same way, which is how rescheduling works.
 *   4. The seller may cancel. A refund is not automatic.
 *
 * Only the open proposal is stored (`proposed_times`, `proposed_by`); a
 * confirmed time must be one of the times the OTHER side proposed, so
 * neither side can confirm a time only they chose.
 *
 * Access: seller functions take the seller's user id from the session and
 * match `seller_user_id`; buyer functions take the token. Emails go through
 * @elkdonis/email's sendEmail; a failed email never undoes a state change.
 */

import { randomBytes } from "node:crypto";
import { db } from "@elkdonis/db";

type Row = Record<string, unknown>;

export type ServiceBookingStatus =
  | "awaiting_payment"
  | "awaiting_seller"
  | "awaiting_buyer"
  | "confirmed"
  | "cancelled";

export interface ServiceBooking {
  id: string;
  orderId: string;
  orderNumber: string | null;
  threadId: string;
  orgId: string;
  serviceTitle: string;
  sellerUserId: string | null;
  sellerName: string | null;
  sellerEmail: string | null;
  buyerUserId: string | null;
  buyerEmail: string;
  buyerName: string | null;
  buyerTimeZone: string;
  durationMinutes: number | null;
  status: ServiceBookingStatus;
  proposedBy: "buyer" | "seller" | null;
  /** ISO strings, the open proposal. */
  proposedTimes: string[];
  scheduledAt: string | null;
  lastMessage: string | null;
  lastMessageBy: "buyer" | "seller" | null;
  createdAt: string;
  updatedAt: string;
}

/** A booking as the buyer's page shows it: the token itself is never returned. */
export type BuyerServiceBooking = Omit<ServiceBooking, "sellerEmail" | "buyerUserId">;

export const MAX_PROPOSED_TIMES = 3;
/** A proposed start must be at least this far ahead. */
const MIN_LEAD_MS = 60 * 60 * 1000;
/** …and no further ahead than this. */
const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;

const NETWORK_URL = (
  process.env.ARTS_COLLECTIVE_URL ??
  process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ??
  "https://arts-collective.com"
).replace(/\/$/, "");

export function sellerBookingsUrl(): string {
  return `${NETWORK_URL}/hub/bookings`;
}

export function buyerBookingUrl(token: string): string {
  return `${NETWORK_URL}/bookings/${token}`;
}

// ── validation ────────────────────────────────────────────────────────────

/**
 * Proposed start times from a form: ISO strings (the browser converts its
 * local wall-clock before sending). 1 to MAX_PROPOSED_TIMES distinct times,
 * each at least an hour ahead and within a year. Returns the times sorted, or
 * a sentence for the person proposing.
 */
export function parseProposedTimes(
  values: unknown,
  now: Date = new Date()
): { ok: true; times: Date[] } | { ok: false; error: string } {
  const list = (Array.isArray(values) ? values : [])
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map((v) => new Date(v));
  if (list.length === 0) return { ok: false, error: "Suggest at least one time." };
  if (list.length > MAX_PROPOSED_TIMES) return { ok: false, error: `Suggest at most ${MAX_PROPOSED_TIMES} times.` };
  if (list.some((d) => Number.isNaN(d.getTime()))) return { ok: false, error: "One of the times could not be read." };
  if (list.some((d) => d.getTime() < now.getTime() + MIN_LEAD_MS)) {
    return { ok: false, error: "Each time needs to be at least an hour from now." };
  }
  if (list.some((d) => d.getTime() > now.getTime() + MAX_AHEAD_MS)) {
    return { ok: false, error: "Each time needs to be within the next year." };
  }
  const unique = [...new Map(list.map((d) => [d.getTime(), d])).values()].sort((a, b) => a.getTime() - b.getTime());
  return { ok: true, times: unique };
}

function validTimeZone(tz: unknown): string {
  if (typeof tz !== "string" || !tz) return "America/Toronto";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return "America/Toronto";
  }
}

function cleanMessage(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().slice(0, 1000) : "";
  return s || null;
}

// ── reads ─────────────────────────────────────────────────────────────────

const SELECT = db`
  SELECT b.*, o.number AS order_number, o.status AS order_status, t.title AS service_title,
         s.display_name AS seller_name, s.email AS seller_email
  FROM service_bookings b
  JOIN commerce_order o ON o.id = b.order_id
  JOIN threads t ON t.id = b.thread_id
  LEFT JOIN users s ON s.id = b.seller_user_id
`;

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());

function mapBooking(r: Row): ServiceBooking {
  return {
    id: r.id as string,
    orderId: r.order_id as string,
    orderNumber: (r.order_number as string | null) ?? null,
    threadId: r.thread_id as string,
    orgId: r.org_id as string,
    serviceTitle: r.service_title as string,
    sellerUserId: (r.seller_user_id as string | null) ?? null,
    sellerName: (r.seller_name as string | null) ?? null,
    sellerEmail: (r.seller_email as string | null) ?? null,
    buyerUserId: (r.buyer_user_id as string | null) ?? null,
    buyerEmail: r.buyer_email as string,
    buyerName: (r.buyer_name as string | null) ?? null,
    buyerTimeZone: r.buyer_time_zone as string,
    durationMinutes: r.duration_minutes == null ? null : Number(r.duration_minutes),
    status: r.status as ServiceBookingStatus,
    proposedBy: (r.proposed_by as "buyer" | "seller" | null) ?? null,
    proposedTimes: ((r.proposed_times as unknown[]) ?? []).map((d) => iso(d)!).filter(Boolean),
    scheduledAt: iso(r.scheduled_at),
    lastMessage: (r.last_message as string | null) ?? null,
    lastMessageBy: (r.last_message_by as "buyer" | "seller" | null) ?? null,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

function forBuyer(b: ServiceBooking): BuyerServiceBooking {
  const { sellerEmail: _e, buyerUserId: _u, ...rest } = b;
  return rest;
}

/** The seller's bookings, paid ones only, open requests first. */
export async function listSellerBookings(sellerUserId: string): Promise<ServiceBooking[]> {
  const rows = (await db`
    ${SELECT}
    WHERE b.seller_user_id = ${sellerUserId} AND b.status <> 'awaiting_payment'
    ORDER BY (b.status = 'awaiting_seller') DESC,
             (b.status = 'confirmed' AND b.scheduled_at >= NOW()) DESC,
             COALESCE(b.scheduled_at, b.updated_at) ASC
    LIMIT 200
  `) as unknown as Row[];
  return rows.map(mapBooking);
}

/** One of the seller's own bookings (paid), or null. */
export async function getSellerBooking(sellerUserId: string, bookingId: string): Promise<ServiceBooking | null> {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return null;
  const [row] = (await db`
    ${SELECT} WHERE b.id = ${bookingId} AND b.seller_user_id = ${sellerUserId} AND b.status <> 'awaiting_payment' LIMIT 1
  `) as unknown as Row[];
  return row ? mapBooking(row) : null;
}

/** One booking by its buyer link, or null. Unpaid bookings are not shown. */
export async function getBookingByToken(token: string): Promise<BuyerServiceBooking | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = (await db`
    ${SELECT} WHERE b.buyer_token = ${token} AND b.status <> 'awaiting_payment' LIMIT 1
  `) as unknown as Row[];
  return row ? forBuyer(mapBooking(row)) : null;
}

async function loadById(id: string): Promise<(ServiceBooking & { token: string }) | null> {
  const [row] = (await db`${SELECT} WHERE b.id = ${id} LIMIT 1`) as unknown as Row[];
  return row ? { ...mapBooking(row), token: row.buyer_token as string } : null;
}

// ── writes ────────────────────────────────────────────────────────────────

export interface CreateServiceBookingInput {
  orderId: string;
  buyerTimeZone?: string | null;
  /** Already parsed with parseProposedTimes. */
  proposedTimes: Date[];
  message?: string | null;
}

/**
 * Attach a schedule to a card order just created for a service (before the
 * buyer pays). Thread, seller, buyer and length are read from the order, so a
 * caller cannot point a booking at someone else's service.
 */
export async function createServiceBooking(input: CreateServiceBookingInput): Promise<{ id: string }> {
  const [line] = (await db`
    SELECT o.id AS order_id, o.customer_id, o.customer_email, o.customer_name,
           l.thread_id, t.org_id, t.author_id, wp.session_duration_hrs
    FROM commerce_order o
    JOIN commerce_order_line l ON l.order_id = o.id AND l.thread_id IS NOT NULL
    JOIN threads t ON t.id = l.thread_id AND t.kind = 'service'
    LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
    WHERE o.id = ${input.orderId}
    LIMIT 1
  `) as unknown as Row[];
  if (!line) throw new Error("That order is not a service booking.");
  const hours = line.session_duration_hrs == null ? null : Number(line.session_duration_hrs);
  const token = randomBytes(24).toString("base64url");
  const [row] = (await db`
    INSERT INTO service_bookings (
      order_id, thread_id, org_id, seller_user_id, buyer_user_id,
      buyer_email, buyer_name, buyer_time_zone, duration_minutes,
      status, proposed_by, proposed_times, last_message, last_message_by, buyer_token
    ) VALUES (
      ${input.orderId}, ${line.thread_id as string}, ${line.org_id as string},
      ${(line.author_id as string | null) ?? null}, ${(line.customer_id as string | null) ?? null},
      ${line.customer_email as string}, ${(line.customer_name as string | null) ?? null},
      ${validTimeZone(input.buyerTimeZone)}, ${hours ? Math.round(hours * 60) : null},
      'awaiting_payment', 'buyer', ${input.proposedTimes.map((d) => d.toISOString())}::timestamptz[],
      ${cleanMessage(input.message)}, ${cleanMessage(input.message) ? "buyer" : null}, ${token}
    )
    ON CONFLICT (order_id) DO UPDATE SET
      proposed_times  = EXCLUDED.proposed_times,
      buyer_time_zone = EXCLUDED.buyer_time_zone,
      updated_at      = NOW()
    WHERE service_bookings.status = 'awaiting_payment'
    RETURNING id
  `) as unknown as Row[];
  if (!row) throw new Error("This booking has already been paid.");
  return { id: row.id as string };
}

/**
 * The order behind a booking was paid: open the buyer's proposal to the
 * seller and tell both. Idempotent — only the first call finds the row
 * `awaiting_payment`, so a webhook and a return hop cannot email twice.
 * Called by confirmOrderPaid after its transaction commits.
 */
export async function markServiceBookingPaid(orderId: string): Promise<void> {
  const [row] = (await db`
    UPDATE service_bookings SET status = 'awaiting_seller', updated_at = NOW()
    WHERE order_id = ${orderId} AND status = 'awaiting_payment'
    RETURNING id
  `) as unknown as Row[];
  if (!row) return;
  const b = await loadById(row.id as string);
  if (!b) return;
  await Promise.all([
    notify(b.sellerEmail, `New booking: ${b.serviceTitle}`, [
      `${b.buyerName ?? b.buyerEmail} booked and paid for <strong>${esc(b.serviceTitle)}</strong>.`,
      `Times they suggested (${esc(b.buyerTimeZone)}):`,
      timesList(b.proposedTimes, b.buyerTimeZone),
      b.lastMessage ? `Their note: “${esc(b.lastMessage)}”` : "",
      button(sellerBookingsUrl(), "Confirm a time"),
      "If none of these suit you, you can suggest other times from the same page.",
    ], b.orgId, b.buyerEmail),
    notify(b.buyerEmail, `Booked: ${b.serviceTitle}`, [
      `Thank you — your booking of <strong>${esc(b.serviceTitle)}</strong> is paid.`,
      `${esc(b.sellerName ?? "They")} will confirm one of the times you suggested, or suggest others. We will email you either way.`,
      button(buyerBookingUrl(b.token), "See your booking"),
    ], b.orgId, b.sellerEmail),
  ]);
}

type ActResult = { ok: true } | { ok: false; error: string };

/** Which row an action may touch: the seller's own, or the one the token names. */
function whereBooking(k: { sellerUserId: string; bookingId: string } | { token: string }) {
  return "token" in k
    ? db`buyer_token = ${k.token}`
    : db`id = ${k.bookingId} AND seller_user_id = ${k.sellerUserId}`;
}
type Where = ReturnType<typeof whereBooking>;

/** Pick one of the other side's open times. */
async function confirmAs(
  who: "buyer" | "seller",
  where: Where,
  at: string
): Promise<ActResult & { id?: string }> {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "That time could not be read." };
  if (when.getTime() < Date.now()) return { ok: false, error: "That time has passed; suggest others instead." };
  const other = who === "buyer" ? "seller" : "buyer";
  const [row] = (await db`
    UPDATE service_bookings SET
      status = 'confirmed', scheduled_at = ${when.toISOString()}::timestamptz,
      proposed_times = '{}', proposed_by = NULL, updated_at = NOW()
    WHERE ${where}
      AND status = ${who === "seller" ? "awaiting_seller" : "awaiting_buyer"}
      AND proposed_by = ${other}
      AND ${when.toISOString()}::timestamptz = ANY(proposed_times)
    RETURNING id
  `) as unknown as Row[];
  if (!row) return { ok: false, error: "That time is no longer open. Reload and try again." };
  return { ok: true, id: row.id as string };
}

/** Propose new times to the other side (also how a confirmed time is moved). */
async function proposeAs(
  who: "buyer" | "seller",
  where: Where,
  times: unknown,
  message: unknown
): Promise<ActResult & { id?: string }> {
  const parsed = parseProposedTimes(times);
  if (parsed.ok === false) return parsed;
  const note = cleanMessage(message);
  const [row] = (await db`
    UPDATE service_bookings SET
      status = ${who === "seller" ? "awaiting_buyer" : "awaiting_seller"},
      proposed_by = ${who},
      proposed_times = ${parsed.times.map((d) => d.toISOString())}::timestamptz[],
      scheduled_at = NULL,
      last_message = ${note}, last_message_by = ${note ? who : null},
      updated_at = NOW()
    WHERE ${where} AND status IN ('awaiting_seller', 'awaiting_buyer', 'confirmed')
    RETURNING id
  `) as unknown as Row[];
  if (!row) return { ok: false, error: "This booking can no longer be changed." };
  return { ok: true, id: row.id as string };
}

export async function sellerConfirmTime(sellerUserId: string, bookingId: string, at: string): Promise<ActResult> {
  const r = await confirmAs("seller", whereBooking({ sellerUserId, bookingId }), at);
  if (r.ok === false) return r;
  await announceConfirmed(bookingId);
  return { ok: true };
}

export async function sellerProposeTimes(
  sellerUserId: string,
  bookingId: string,
  times: unknown,
  message?: unknown
): Promise<ActResult> {
  const r = await proposeAs("seller", whereBooking({ sellerUserId, bookingId }), times, message);
  if (r.ok === false) return r;
  const b = await loadById(bookingId);
  if (b) {
    await notify(b.buyerEmail, `New times suggested: ${b.serviceTitle}`, [
      `${esc(b.sellerName ?? "They")} suggested these times for <strong>${esc(b.serviceTitle)}</strong> (${esc(b.buyerTimeZone)}):`,
      timesList(b.proposedTimes, b.buyerTimeZone),
      b.lastMessage ? `Their note: “${esc(b.lastMessage)}”` : "",
      button(buyerBookingUrl(b.token), "Choose a time"),
      "If none suit you, you can suggest others from the same page.",
    ], b.orgId, b.sellerEmail);
  }
  return { ok: true };
}

/** Cancel a booking. Tells the buyer; any refund is issued separately. */
export async function sellerCancelBooking(sellerUserId: string, bookingId: string, message?: unknown): Promise<ActResult> {
  const note = cleanMessage(message);
  const [row] = (await db`
    UPDATE service_bookings SET status = 'cancelled', proposed_times = '{}', proposed_by = NULL,
      last_message = ${note}, last_message_by = ${note ? "seller" : null}, updated_at = NOW()
    WHERE id = ${bookingId} AND seller_user_id = ${sellerUserId}
      AND status IN ('awaiting_seller', 'awaiting_buyer', 'confirmed')
    RETURNING id
  `) as unknown as Row[];
  if (!row) return { ok: false, error: "This booking can no longer be cancelled here." };
  const b = await loadById(bookingId);
  if (b) {
    await notify(b.buyerEmail, `Cancelled: ${b.serviceTitle}`, [
      `${esc(b.sellerName ?? "The seller")} has cancelled your booking of <strong>${esc(b.serviceTitle)}</strong>.`,
      b.lastMessage ? `Their note: “${esc(b.lastMessage)}”` : "",
      `Reply to this email about a refund${b.orderNumber ? ` (order ${esc(b.orderNumber)})` : ""}.`,
    ], b.orgId, b.sellerEmail);
  }
  return { ok: true };
}

export async function buyerConfirmTime(token: string, at: string): Promise<ActResult> {
  const r = await confirmAs("buyer", whereBooking({ token }), at);
  if (r.ok === false) return r;
  await announceConfirmed(r.id!);
  return { ok: true };
}

export async function buyerProposeTimes(token: string, times: unknown, message?: unknown): Promise<ActResult> {
  const r = await proposeAs("buyer", whereBooking({ token }), times, message);
  if (r.ok === false) return r;
  const b = await loadById(r.id!);
  if (b) {
    await notify(b.sellerEmail, `New times suggested: ${b.serviceTitle}`, [
      `${esc(b.buyerName ?? b.buyerEmail)} suggested these times for <strong>${esc(b.serviceTitle)}</strong> (${esc(b.buyerTimeZone)}):`,
      timesList(b.proposedTimes, b.buyerTimeZone),
      b.lastMessage ? `Their note: “${esc(b.lastMessage)}”` : "",
      button(sellerBookingsUrl(), "Choose a time"),
    ], b.orgId, b.buyerEmail);
  }
  return { ok: true };
}

async function announceConfirmed(bookingId: string): Promise<void> {
  const b = await loadById(bookingId);
  if (!b || !b.scheduledAt) return;
  const ics = `${buyerBookingUrl(b.token)}/calendar.ics`;
  await Promise.all([
    notify(b.buyerEmail, `Confirmed: ${b.serviceTitle}`, [
      `<strong>${esc(b.serviceTitle)}</strong> with ${esc(b.sellerName ?? "your host")} is confirmed for:`,
      `<strong>${esc(formatTime(b.scheduledAt, b.buyerTimeZone))}</strong>`,
      button(ics, "Add to calendar"),
      `Need to move it? <a href="${buyerBookingUrl(b.token)}">Suggest other times</a>.`,
    ], b.orgId, b.sellerEmail),
    notify(b.sellerEmail, `Confirmed: ${b.serviceTitle} with ${b.buyerName ?? b.buyerEmail}`, [
      `<strong>${esc(b.serviceTitle)}</strong> with ${esc(b.buyerName ?? b.buyerEmail)} is confirmed for:`,
      `<strong>${esc(formatTime(b.scheduledAt, b.buyerTimeZone))}</strong> (their time zone)`,
      button(ics, "Add to calendar"),
      `Reply to this email to reach them. Changes: <a href="${sellerBookingsUrl()}">your bookings</a>.`,
    ], b.orgId, b.buyerEmail),
  ]);
}

// ── calendar file ─────────────────────────────────────────────────────────

/** An iCalendar event for a confirmed booking, or null when it has no time. */
export function bookingIcs(b: Pick<ServiceBooking, "id" | "serviceTitle" | "scheduledAt" | "durationMinutes" | "sellerName" | "buyerName">): string | null {
  if (!b.scheduledAt) return null;
  const start = new Date(b.scheduledAt);
  const end = new Date(start.getTime() + (b.durationMinutes ?? 60) * 60_000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, "\\n");
  const who = [b.sellerName, b.buyerName].filter(Boolean).join(" and ");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Elkdonis Arts Collective//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${b.id}@arts-collective.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(b.serviceTitle)}`,
    ...(who ? [`DESCRIPTION:${text(who)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

// ── email ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function formatTime(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(isoString));
}

function timesList(times: string[], tz: string): string {
  return `<ul>${times.map((t) => `<li>${esc(formatTime(t, tz))}</li>`).join("")}</ul>`;
}

function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;padding:10px 18px;background:#1f1f1f;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600">${esc(label)}</a>`;
}

async function notify(
  to: string | null,
  subject: string,
  paragraphs: string[],
  orgId: string,
  replyTo: string | null
): Promise<void> {
  if (!to) return;
  try {
    const { sendEmail } = await import("@elkdonis/email");
    const html = `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#1f1f1f">${paragraphs
      .filter(Boolean)
      .map((p) => (p.startsWith("<ul>") ? p : `<p>${p}</p>`))
      .join("")}</div>`;
    await sendEmail({ to, subject, html, orgId, kind: "order", ...(replyTo ? { replyTo } : {}) });
  } catch (err) {
    console.error(`[commerce] booking email "${subject}" failed:`, err);
  }
}
