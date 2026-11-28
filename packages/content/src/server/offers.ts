// ============================================================================
// @elkdonis/content/server: the offers view's pieces (CONTRACT §16 revised / v1.4).
//
// Paid work reached through search: which index rows are offers (SQL), the filters
// and facets of the offers view, and how a hydrated item's `offer` is derived.
// Nothing here computes money: prices are the stored list prices, and `checkout` only
// says whether the payee has a payout route (the same test as checkout's
// bookingAvailability, repeated so content does not import app or checkout code).
// ============================================================================

import { db } from "@elkdonis/db";
import type { ContentOffer, ContentOfferKind, ContentTakeUp } from "../model";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Frag = any;

/** Thread types that are offers when priced or RSVP-enabled. A series is an offer by itself (take-up: subscribe). */
export const OFFER_THREAD_TYPES = ["meeting", "event", "workshop", "service"] as const;

/** Thread kinds commerce sells (service-orders.ts PURCHASABLE_THREAD_KINDS, the ones the surfaces take payment for). */
const PAYABLE_KINDS = ["service", "workshop", "event"];

/** Index type -> offer kind: meetings read as events; artwork and product are artwork. */
export function offerKindOfType(type: string): ContentOfferKind {
  return type === "meeting" || type === "event" ? "event" : type === "service" ? "service" : type === "series" ? "series" : type === "workshop" ? "workshop" : "artwork";
}

/** SQL over `ci`: the rows that are offers. Published, not hidden; artwork for sale; threads priced or RSVP-enabled (series always). */
export function offerRowSql(): Frag {
  return db`(ci.status = 'published' AND NOT ci.hidden AND (
    (ci.store = 'artwork' AND ci.sale_state = 'for_sale')
    OR (ci.store = 'thread' AND ci.type = 'series')
    OR (ci.store = 'thread' AND ci.type = ANY(${[...OFFER_THREAD_TYPES]}::text[]) AND (
      COALESCE(ci.price_minor, 0) > 0
      OR EXISTS (SELECT 1 FROM threads t WHERE t.id = ci.id AND t.is_rsvp_enabled))))
  )`;
}

/** SQL over `ci`: the offer kind of a row. */
export const offerKindSql = (): Frag => db`(CASE WHEN ci.type IN ('meeting', 'event') THEN 'event' WHEN ci.type = 'service' THEN 'service'
  WHEN ci.type = 'series' THEN 'series' WHEN ci.type = 'workshop' THEN 'workshop' ELSE 'artwork' END)`;

export const pricedSql = (): Frag => db`COALESCE(ci.price_minor, 0) > 0`;

/** What a thread row says about its price, as the indexer computes it (workshop member price first, like commerce). */
export interface OfferThreadFacts {
  kind: string;               // threads.kind
  type: string;               // index type
  priceMinor: number | null;  // already minor units
  currency: string | null;
  slidingMinMinor: number | null;
  rsvp: boolean;
  limit: number | null;
  coming: number;
  registrationOpen: boolean;
  start: string | null;
}

export interface OfferDeriveCtx { cardAvailable: boolean; payoutOk: boolean }

export function takeUpOf(f: { artwork?: boolean; type: string; kind?: string; priced: boolean; rsvp: boolean; registrationOpen?: boolean }): ContentTakeUp {
  if (f.artwork) return "order";
  if (f.type === "series") return "subscribe";
  if (f.priced && PAYABLE_KINDS.includes(f.kind ?? f.type)) return f.registrationOpen === false ? "none" : "pay";
  if (f.rsvp) return "rsvp";
  return "enquire";
}

export function offerOfThread(f: OfferThreadFacts, ctx: OfferDeriveCtx): ContentOffer {
  const priced = f.priceMinor != null && f.priceMinor > 0;
  const takeUp = takeUpOf({ type: f.type, kind: f.kind, priced, rsvp: f.rsvp, registrationOpen: f.registrationOpen });
  const price = priced && f.currency ? { amountMinor: f.priceMinor!, currency: f.currency } : null;
  const floor = f.slidingMinMinor;
  return {
    kind: offerKindOfType(f.type),
    price,
    ...(price && floor != null && floor > 0 && floor < price.amountMinor ? { sliding: { minMinor: floor, maxMinor: price.amountMinor } } : {}),
    takeUp,
    checkout: takeUp === "pay" && ctx.cardAvailable && ctx.payoutOk,
    when: f.start ? { start: f.start } : null,
    capacity: f.rsvp || f.limit != null ? { limit: f.limit, coming: f.coming } : null,
  };
}

export function offerOfArtwork(a: { priceMinor: number | null; currency: string | null }, ctx: OfferDeriveCtx): ContentOffer {
  const price = a.priceMinor != null && a.priceMinor > 0 && a.currency ? { amountMinor: a.priceMinor, currency: a.currency } : null;
  return { kind: "artwork", price, takeUp: "order", checkout: ctx.cardAvailable && ctx.payoutOk && price != null, when: null, capacity: null };
}

/** users.id (as text) -> the payee can be paid (an eTransfer address or a Stripe account), as checkout's bookingAvailability tests. */
export async function payoutRoutes(userIds: string[]): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return out;
  const rows = await db<Array<{ id: string; ok: boolean }>>`
    SELECT id::text AS id, (COALESCE(payout_email, '') <> '' OR COALESCE(stripe_account_id, '') <> '') AS ok
    FROM users WHERE id = ANY(${ids}::uuid[])`;
  for (const r of rows) out.set(r.id, r.ok);
  return out;
}

/** Card payments are on when a Stripe key is configured (checkout isCardPaymentAvailable). Reads the env only; no Stripe call. */
export const cardAvailable = (): boolean => Boolean(process.env.STRIPE_SECRET_KEY?.trim());

// ── what commerce will charge (2026-11-27, lane P) ──────────────────────────

/** The list price and currency commerce will charge for a thread, and its sliding-scale range if it has one. */
export interface ThreadCharge {
  amountMinor: number;
  currency: string;
  sliding?: { minMinor: number; maxMinor: number };
}

/**
 * Pure rule, the same as commerce createThreadOrder (service-orders.ts): `workshop_pages.price_member` when set
 * (even 0), else `threads.price`; MAJOR units rounded to minor; no price (not above zero) means not for sale;
 * currency is `threads.currency`, CAD when empty. `price_sliding_min` below the list price gives the sliding range.
 */
export function chargeOfThreadRow(r: {
  price_member: string | number | null;
  price: string | number | null;
  currency: string | null;
  price_sliding_min: string | number | null;
}): ThreadCharge | null {
  const major = r.price_member != null ? Number(r.price_member) : Number(r.price ?? 0);
  const amountMinor = Math.round(major * 100);
  if (!(amountMinor > 0)) return null;
  const currency = (r.currency || "CAD").toUpperCase();
  const floor = r.price_sliding_min != null ? Math.round(Number(r.price_sliding_min) * 100) : null;
  return {
    amountMinor,
    currency,
    ...(floor != null && floor > 0 && floor < amountMinor ? { sliding: { minMinor: floor, maxMinor: amountMinor } } : {}),
  };
}

/**
 * The price and currency a buyer will actually be charged for `key` (`thread:<id>`, or a bare thread id): what a
 * page should show, so page and charge cannot differ. Reads `threads` and `workshop_pages` (read-only). Returns null
 * for an unknown thread or one with no price. It does NOT check that the thread is published or readable: the
 * caller already holds a row it may show, and checkout's own rights gate still applies when paying.
 */
export async function threadChargeFor(key: string): Promise<ThreadCharge | null> {
  const id = key.startsWith("thread:") ? key.slice("thread:".length) : key;
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return null;
  const [r] = await db<Array<{ price_member: string | null; price: string | null; currency: string | null; price_sliding_min: string | null }>>`
    SELECT wp.price_member::text AS price_member, t.price::text AS price, t.currency, wp.price_sliding_min::text AS price_sliding_min
    FROM threads t LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
    WHERE t.id = ${id} LIMIT 1`;
  return r ? chargeOfThreadRow(r) : null;
}
