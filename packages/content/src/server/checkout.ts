// ============================================================================
// @elkdonis/content/server checkout: pay for a priced offer through the content library, org-agnostic
// (2026-11-27, docs/open/OFFER_SURFACES_2026-11-27.md).
//
// A host (any app that mounts contentRoutes) can sell any org's priced thread or artwork by KEY, because
// the key is resolved through the content index rights (resolveContentRefs: only what this viewer may read,
// published). The seller of record is the network org `oad`; the PAYEE is unchanged: the thread's author,
// by resolveSettlement, with the thread's own org taking a cut only under an accepted agreement.
//
//   thread:<id>   createThreadOrder({ networkSale: true, orgId: "oad" }): price, sliding range, quantity,
//                 published and open-registration refusals are commerce's own.
//   artwork:<id>  the market's own createOrder (store commission regime, stock lock, reservation); a work that
//                 needs a shipping quote (migration 250) is handed to the market's order page, which owns the
//                 courier choice, rather than going to Stripe with no shipping.
//
// Stripe is injected (`payments`): this package does not depend on @elkdonis/checkout. The app passes
// `isCardPaymentAvailable`, `startStripeCheckout` and `syncStripeOrder` from "@elkdonis/checkout/stripe".
// Nothing here talks to Stripe except through that object, so every step before it can be tested alone.
// ============================================================================

import { db } from "@elkdonis/db";
import { createOrder, createThreadOrder, loadVariantItem } from "@elkdonis/commerce/server";
import type { ContentHost } from "../host";
import { ARTDIRECT_URL, MARKET_URL, NETWORK_HOST } from "../host";
import { recordNetworkBooking, releaseBooking } from "@elkdonis/services/network-booking";
import { PERSONAL_ORG, type ContentViewer } from "./access";
import { resolveContentRefs } from "./search";

/** The Stripe steps a host supplies (structurally the exports of @elkdonis/checkout/stripe). */
export interface ContentPayments {
  isCardPaymentAvailable(): boolean;
  startStripeCheckout(input: {
    orderId: string;
    successUrl: string;
    cancelUrl: string;
    imageBase?: string | null;
    idempotencyKey?: string;
  }): Promise<{ url: string }>;
  syncStripeOrder(orderId: string): Promise<unknown>;
}

/** The order-making steps, overridable so a test can stop before any write. */
export interface ContentOrders {
  createThreadOrder: typeof createThreadOrder;
  createOrder: typeof createOrder;
  /** A paid service also gets a booking (booking module) so ArtDirect's bookings list it; see recordNetworkBooking. */
  recordNetworkBooking: typeof recordNetworkBooking;
  releaseBooking: typeof releaseBooking;
  loadVariantItem: typeof loadVariantItem;
  /** True when the order must pick a courier on the market's order page before paying (migration 250). */
  shippingRequired(orderId: string): Promise<boolean>;
}

export interface ContentCheckoutContext {
  host: ContentHost;
  payments: ContentPayments;
  /** The public origin the browser used (https://<host>), for the Stripe return URLs. */
  origin: string;
  orders?: Partial<ContentOrders>;
  /** Abuse limiter (per IP and per email); defaults to a per-process in-memory one. See `redisRateLimiter`. */
  limiter?: RateLimiter;
  /** The rights gate; defaults to resolveContentRefs. Overridable for tests only. */
  resolve?: typeof resolveContentRefs;
}

/** The body of POST /api/content/checkout (packages/cms-ui offer-surface CheckoutRequest, structurally). */
export interface ContentCheckoutRequest {
  key: string;
  quantity?: number;
  amountMinor?: number;
  slotId?: string;
  delivery?: "ship" | "collect";
  address?: string;
  email?: string;
  returnTo: string;
}

export type ContentCheckoutResult =
  | { ok: true; url: string; orderId: string; /** The market finishes this one (choice or shipping): `url` is its page, not Stripe's. */ handoff?: boolean }
  | { ok: false; error: string; loginHref?: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const KEY_RE = /^(thread|artwork):([A-Za-z0-9_-]{1,40}|[0-9a-f-]{36})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,48}$/;
const MAX_NOTE = 1000;

type OfferKind = "event" | "service" | "artwork";
const FLOW_OF: Record<OfferKind, "evt" | "svc" | "art"> = { event: "evt", service: "svc", artwork: "art" };
const OFFER_LAYER_OF: Record<OfferKind, "evt-offer" | "svc-offer" | "art-offer"> = { event: "evt-offer", service: "svc-offer", artwork: "art-offer" };

/**
 * The `?surface=` value that opens the Done layer, in the form the surface URL parser reads
 * (cms-ui offer-surface descriptor.ts offerSurfaceValue): `offer:done:<encodeURIComponent(key)>:<svc|evt|art>`.
 * (Before 2026-11-27 this wrote `<kind>-offer/done`, which the parser dropped.)
 */
export function doneSurfaceFor(offerKind: OfferKind, key: string): string {
  return `offer:done:${encodeURIComponent(key)}:${FLOW_OF[offerKind]}`;
}

/** The `?surface=` value of the offer layer a cancelled payment goes back to: `offer:<svc|evt|art>-offer:<encoded key>`. */
export function offerSurfaceFor(offerKind: OfferKind, key: string): string {
  return `offer:${OFFER_LAYER_OF[offerKind]}:${encodeURIComponent(key)}`;
}

/**
 * Whether `hostHeader` (host[:port]) is one of OUR hosts: the host's own site domain, a registered org domain
 * (org_domains), or `<existing org slug>.<network host>`. Nothing else counts, so a forged Host or
 * X-Forwarded-Host never passes. Used for the request host, the Origin header and `returnTo`.
 */
export async function isOwnHost(hostHeader: string | null, host: ContentHost): Promise<boolean> {
  const full = (hostHeader ?? "").trim().toLowerCase();
  if (!full || /[\s/@\\]/.test(full)) return false;
  const bare = full.replace(/:\d+$/, "");
  const site = host.site.domain.trim().toLowerCase();
  if (site && (full === site || bare === site.replace(/:\d+$/, ""))) return true;
  const rows = await db<Array<{ n: number }>>`SELECT 1 AS n FROM org_domains WHERE domain = ${bare} LIMIT 1`;
  if (rows.length) return true;
  const net = NETWORK_HOST.replace(/:\d+$/, "");
  if (net && bare.endsWith(`.${net}`)) {
    const slug = bare.slice(0, -(net.length + 1));
    if (SLUG_RE.test(slug)) {
      const orgs = await db<Array<{ n: number }>>`SELECT 1 AS n FROM organizations WHERE slug = ${slug} LIMIT 1`;
      if (orgs.length) return true;
    }
  }
  return false;
}

/** `returnTo` must be an absolute http(s) URL, without credentials, on one of our hosts. Returns it parsed, or null. */
export async function checkReturnTo(returnTo: string, host: ContentHost): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(returnTo);
  } catch {
    return null;
  }
  if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password) return null;
  return (await isOwnHost(u.host, host)) ? u : null;
}

/** The host a request names, from the edge's forwarded headers. NOT yet trusted: pass it to `verifiedOrigin`. */
export function requestHostOf(req: Request): string | null {
  const h = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return h && !h.startsWith("0.0.0.0") ? h.split(",")[0]!.trim() : null;
}

/**
 * https://<host> built only from a request host that passes `isOwnHost`; null otherwise (the route answers 400).
 * http only for a localhost site domain.
 */
export async function verifiedOrigin(req: Request, host: ContentHost): Promise<string | null> {
  const h = requestHostOf(req);
  if (!h || !(await isOwnHost(h, host))) return null;
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(h);
  return `${local ? "http" : "https"}://${h}`;
}

// ── abuse limit ────────────────────────────────────────────────────────────

/** One call per attempt: true = allowed. Fail open on its own errors (an outage must not stop sales). */
export type RateLimiter = (key: string, limit: number, windowSeconds: number) => Promise<boolean>;

const mem = new Map<string, { n: number; reset: number }>();
/** Per-process fixed window. Enough to blunt a single client against one app; use `redisRateLimiter` to share across apps. */
export const memoryRateLimiter: RateLimiter = async (key, limit, windowSeconds) => {
  const now = Date.now();
  if (mem.size > 5000) for (const [k, v] of mem) if (v.reset < now) mem.delete(k);
  const cur = mem.get(key);
  if (!cur || cur.reset < now) { mem.set(key, { n: 1, reset: now + windowSeconds * 1000 }); return true; }
  cur.n += 1;
  return cur.n <= limit;
};

/** INCR + EXPIRE over any ioredis-shaped client (e.g. getRedisClient() from @elkdonis/redis). Fails open, with a log. */
export function redisRateLimiter(client: { incr(k: string): Promise<number>; expire(k: string, s: number): Promise<unknown> }): RateLimiter {
  return async (key, limit, windowSeconds) => {
    try {
      const k = `rl:content-checkout:${key}`;
      const n = await client.incr(k);
      if (n === 1) await client.expire(k, windowSeconds);
      return n <= limit;
    } catch (err) {
      console.error("[content/checkout] rate limiter down, allowing:", err);
      return true;
    }
  };
}

const IP_LIMIT = 10;
const EMAIL_LIMIT = 5;
const WINDOW_S = 600;

/** The client address the edge appended (the LAST X-Forwarded-For entry: earlier ones are client-supplied). */
export function clientIpOf(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  const last = xff?.split(",").map((x) => x.trim()).filter(Boolean).at(-1);
  return (last ?? req.headers.get("x-real-ip") ?? "unknown").slice(0, 64);
}

async function defaultShippingRequired(orderId: string): Promise<boolean> {
  const { getOrderShippingState } = await import("@elkdonis/commerce/shipping");
  return Boolean((await getOrderShippingState(orderId).catch(() => null))?.required);
}

/**
 * Start checkout for one priced offer. `viewer` may be null (guest: an email is required). Never throws for a
 * buyer-facing refusal; those come back as { ok: false, error }. Stripe's own errors are logged and answered
 * with a generic sentence.
 */
export async function startContentCheckout(
  viewer: ContentViewer | null,
  req: ContentCheckoutRequest,
  ctx: ContentCheckoutContext,
  clientIp: string = "unknown"
): Promise<ContentCheckoutResult> {
  const orders: ContentOrders = {
    createThreadOrder: ctx.orders?.createThreadOrder ?? createThreadOrder,
    createOrder: ctx.orders?.createOrder ?? createOrder,
    recordNetworkBooking: ctx.orders?.recordNetworkBooking ?? recordNetworkBooking,
    releaseBooking: ctx.orders?.releaseBooking ?? releaseBooking,
    loadVariantItem: ctx.orders?.loadVariantItem ?? loadVariantItem,
    shippingRequired: ctx.orders?.shippingRequired ?? defaultShippingRequired,
  };

  const m = KEY_RE.exec(String(req.key ?? ""));
  if (!m) return fail("That is not something that can be bought.");
  const store = m[1] as "thread" | "artwork";
  const id = m[2]!;

  const back = await checkReturnTo(String(req.returnTo ?? ""), ctx.host);
  if (!back) return fail("That return address is not one of our sites.");

  if (req.slotId) return fail("Choosing a time here is not available yet. Open the service page to book a time.");
  const quantity = req.quantity == null ? 1 : Math.floor(Number(req.quantity));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 50) return fail("Choose between 1 and 50.");
  if (req.amountMinor != null && (!Number.isFinite(Number(req.amountMinor)) || Number(req.amountMinor) <= 0)) {
    return fail("Enter an amount.");
  }

  // Who is buying: the account's own email, else the guest's.
  let email = (req.email ?? "").trim();
  let name: string | null = null;
  if (viewer) {
    const [u] = await db<Array<{ email: string | null; display_name: string | null }>>`
      SELECT email, display_name FROM users WHERE id = ${viewer.userId} LIMIT 1`;
    if (u?.email) email = u.email;
    name = u?.display_name ?? null;
  }
  if (!EMAIL_RE.test(email)) return fail("Enter an email address so we can send your receipt.");

  // Abuse limit, after the cheap refusals and before any query that makes rows: per client address and per email.
  const limiter = ctx.limiter ?? memoryRateLimiter;
  const emailKey = `e:${email.toLowerCase()}`;
  if (!(await limiter(`ip:${clientIp}`, IP_LIMIT, WINDOW_S)) || !(await limiter(emailKey, EMAIL_LIMIT, WINDOW_S))) {
    return fail("Too many attempts. Please wait a few minutes and try again.");
  }

  if (!ctx.payments.isCardPaymentAvailable()) return fail("Card payments are not switched on yet.");

  // The rights gate: the key must resolve for THIS viewer (published, readable, not hidden). Same rule as
  // every content read; "not readable" and "not there" answer alike. `offers: true` lets a published public service
  // resolve (contentReadSql hides services from every other reader).
  const { results } = await (ctx.resolve ?? resolveContentRefs)(viewer, [`${store}:${id}`], ctx.host, { noDrain: true, offers: true });
  const hit = results[0];
  if (!hit || "gone" in hit) return fail("That is not available to buy.");

  const successBase = `${ctx.origin.replace(/\/$/, "")}/api/content/checkout/return`;
  let orderId: string;
  let offerKind: OfferKind = "service";
  let bookingId: string | null = null;

  try {
    if (store === "thread") {
      const [t] = await db<Array<{ kind: string; org_id: string }>>`SELECT kind, org_id FROM threads WHERE id = ${id} LIMIT 1`;
      if (!t) return fail("That is not available to buy.");
      // The page draws event, meeting, workshop and reading_group as event layers (offer-site.ts kindOf); the rest are services.
      offerKind = ["event", "meeting", "workshop", "reading_group"].includes(t.kind) ? "event" : "service";
      // A service that is booked at a time has its own booking path (open hours, holds); paying here would take
      // money with no time chosen.
      const [bo] = await db<Array<{ n: number }>>`
        SELECT 1 AS n FROM booking_offers WHERE thread_id = ${id} AND status = 'open' LIMIT 1`;
      if (bo) return fail("This one is booked at a time. Open its page to choose a time.");

      // The price is the server's. A client amount counts only for a sliding-scale offer (commerce then holds it to
      // [floor, list price]); for any other offer it is dropped and the list price applies.
      const [wp] = await db<Array<{ price_sliding_min: string | null }>>`
        SELECT price_sliding_min FROM workshop_pages WHERE thread_id = ${id} LIMIT 1`;
      const sliding = wp?.price_sliding_min != null;

      const order = await orders.createThreadOrder({
        orgId: PERSONAL_ORG,
        networkSale: true,
        sellerOrgId: PERSONAL_ORG,
        threadId: id,
        customerEmail: email,
        customerName: name,
        customerId: viewer?.userId ?? null,
        notes: cleanNote(req.address),
        amountMinor: sliding && req.amountMinor != null ? Math.round(Number(req.amountMinor)) : undefined,
        quantity,
        paymentMethod: "stripe",
      });
      orderId = order.id;
      // A service also gets a booking in the booking module (awaiting payment, linked to this order): the
      // existing paid-order hook confirms it, and ArtDirect lists it for the buyer and the author. Price and
      // settlement are not touched. If the booking cannot be made no card session is opened (the unpaid order
      // lapses like any order that never reached Stripe), so money is never taken without a booking.
      if (t.kind === "service") {
        const booked = await orders.recordNetworkBooking({
          threadId: id,
          orderId,
          buyer: { name, email, userId: viewer?.userId ?? null },
          notes: cleanNote(req.address),
          siteUrl: ARTDIRECT_URL,
        });
        if (booked.ok === false) throw new Error("This is not available to buy.");
        bookingId = booked.bookingId;
      }
    } else {
      offerKind = "artwork";
      if (!UUID_RE.test(id)) return fail("That is not available to buy.");
      const [a] = await db<Array<{ sale_state: string | null; status: string; store_status: string }>>`
        SELECT ci.sale_state, a.status, s.status AS store_status
        FROM artwork a
        JOIN store s ON s.id = a.store_id
        LEFT JOIN content_index ci ON ci.key = ${`artwork:${id}`}
        WHERE a.id = ${id}::uuid LIMIT 1`;
      if (!a || a.status !== "available" || a.store_status !== "active" || (a.sale_state ?? "for_sale") !== "for_sale") {
        return fail("That work is not for sale right now.");
      }
      const variants = await db<Array<{ id: string }>>`
        SELECT id FROM artwork_variant WHERE artwork_id = ${id}::uuid AND inventory_qty > 0
        ORDER BY position ASC, price_minor ASC LIMIT 2`;
      const v = variants[0];
      if (!v) return fail("That work is no longer available.");
      // Several sellable variants (editions, sizes): the buyer chooses on the market's piece page. No order yet.
      if (variants.length > 1) return { ok: true, orderId: "", url: `${MARKET_URL}/artworks/${id}`, handoff: true };
      const item = await orders.loadVariantItem(v.id, { qty: quantity });
      const note = [req.delivery === "collect" ? "Delivery: collect" : req.delivery === "ship" ? "Delivery: ship" : null, req.address ? `Address: ${req.address}` : null]
        .filter(Boolean)
        .join("\n");
      const order = await orders.createOrder({
        items: [item],
        paymentMethod: "stripe",
        customerEmail: email,
        customerName: name,
        customerId: viewer?.userId ?? null,
        notes: cleanNote(note),
        metadata: { kind: "offer-surface", sellerOrgId: PERSONAL_ORG },
      });
      orderId = order.id;
      // The market owns the courier choice. A work that needs a quote, or one to be shipped, finishes there.
      if (req.delivery === "ship" || (await orders.shippingRequired(orderId))) {
        return { ok: true, orderId, url: `${MARKET_URL}/orders/${orderId}`, handoff: true };
      }
    }
  } catch (err) {
    return fail(buyerMessage(err));
  }

  // Cancelling lands back on the offer layer (the pay step's parent), never on Done: the page's own `returnTo`
  // carries the done surface, so the cancel address replaces `surface` and adds payment=cancelled (the kit shows the line).
  const offerKey = `${store}:${id}`;
  const cancelBack = new URL(back.toString());
  cancelBack.searchParams.set("surface", offerSurfaceFor(offerKind, offerKey));
  const cancelUrl = withParam(cancelBack, "payment", "cancelled");
  try {
    const { url } = await ctx.payments.startStripeCheckout({
      orderId,
      successUrl: `${successBase}?order=${encodeURIComponent(orderId)}&k=${offerKind}&key=${encodeURIComponent(offerKey)}&to=${encodeURIComponent(back.toString())}`,
      cancelUrl,
      imageBase: ctx.origin,
      idempotencyKey: `order-${orderId}`,
    });
    return { ok: true, orderId, url };
  } catch (err) {
    console.error(`[content/checkout] order ${orderId}: card session not opened:`, err);
    if (bookingId) await orders.releaseBooking(bookingId, "card session not opened").catch(() => {});
    return fail("Card payment could not be opened. Please try again in a moment.");
  }
}

/**
 * The return hop: reconcile the order (the webhook may be a second behind), then send the buyer to `to` with
 * the Done layer open. `to` arrives through the browser, so it is checked again; a bad one goes to `fallback`.
 */
export async function finishContentCheckout(
  req: Request,
  ctx: Pick<ContentCheckoutContext, "payments" | "origin" | "host">
): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const orderId = sp.get("order");
  if (orderId && UUID_RE.test(orderId)) {
    await ctx.payments.syncStripeOrder(orderId).catch((err) => console.error(`[content/checkout] return ${orderId}:`, err));
  }
  const kind = sp.get("k");
  const offerKind = kind === "event" || kind === "artwork" ? kind : "service";
  const dest = await checkReturnTo(sp.get("to") ?? "", ctx.host);
  const target = dest ?? new URL(ctx.origin);
  if (dest) {
    // Keep the page's own Done value (the pay layer put it in `returnTo`); write it only when the page gave none.
    // `key` is checked like the checkout request's: nothing else reaches the address.
    const keep = dest.searchParams.get("surface");
    const key = sp.get("key") ?? "";
    if (!keep || !keep.startsWith("offer:done:")) {
      if (KEY_RE.test(key)) target.searchParams.set("surface", doneSurfaceFor(offerKind, key));
      else target.searchParams.delete("surface");
    }
    target.searchParams.delete("payment");
    target.searchParams.set("paid", "1");
  }
  return Response.redirect(target.toString(), 303);
}

function withParam(u: URL, k: string, v: string): string {
  const c = new URL(u.toString());
  c.searchParams.set(k, v);
  return c.toString();
}

function cleanNote(s: string | null | undefined): string | null {
  const t = (s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, MAX_NOTE);
  return t || null;
}

/**
 * Commerce throws Errors whose message is written for the buyer ("This has no price set."); anything else
 * (a database error) is logged and answered generically.
 */
function buyerMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  const known = /not available|not open|no price|sliding|outside|no longer|reserved|left\.|payouts|card payments only|more places|quantity|seller|basket/i;
  if (msg && known.test(msg)) return msg;
  console.error("[content/checkout]", err);
  return "This could not be ordered right now.";
}

const NO_STORE = { "Cache-Control": "no-store" } as const;
const jsonOut = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

/**
 * The two route handlers, built here so routes.ts only forwards them (CONTRACT §5 pattern):
 *   checkout        POST /api/content/checkout          body ContentCheckoutRequest -> ContentCheckoutResult
 *   checkoutReturn  GET  /api/content/checkout/return   ?order=&k=&to=  (Stripe's success URL) -> 303
 * The viewer comes from host.viewer(req), never from the body. A signed-out visitor may check out as a guest.
 */
export function contentCheckoutRoutes(host: ContentHost, payments: ContentPayments, limiter?: RateLimiter) {
  async function checkout(req: Request): Promise<Response> {
    if (req.method !== "POST") return jsonOut({ ok: false, error: "POST only" }, 405);
    const origin = await verifiedOrigin(req, host);
    if (!origin) return jsonOut({ ok: false, error: "Could not tell which site this is." }, 400);
    // CSRF: JSON only (a cross-site form cannot send it without a preflight), and a present Origin must be ours.
    if (!/^application\/json\b/i.test(req.headers.get("content-type") ?? "")) return jsonOut({ ok: false, error: "Send JSON." }, 403);
    const originHdr = req.headers.get("origin");
    if (originHdr) {
      let oh: string | null = null;
      try { oh = new URL(originHdr).host; } catch { /* malformed: refused below */ }
      if (!oh || !(await isOwnHost(oh, host))) return jsonOut({ ok: false, error: "Not allowed from there." }, 403);
    }
    let viewer: ContentViewer | null;
    try {
      viewer = await host.viewer(req);
    } catch (err) {
      console.error("[content/checkout] viewer:", err);
      return jsonOut({ ok: false, error: "Could not tell who is asking." }, 500);
    }
    const body = (await req.json().catch(() => null)) as ContentCheckoutRequest | null;
    if (!body || typeof body !== "object" || typeof body.key !== "string" || typeof body.returnTo !== "string") {
      return jsonOut({ ok: false, error: "key and returnTo are required." }, 400);
    }
    try {
      const out = await startContentCheckout(viewer, body, { host, payments, origin, limiter }, clientIpOf(req));
      return jsonOut(out, out.ok ? 200 : 400);
    } catch (err) {
      console.error("[content/checkout]", err);
      return jsonOut({ ok: false, error: "This could not be ordered right now." }, 500);
    }
  }

  async function checkoutReturn(req: Request): Promise<Response> {
    if (req.method !== "GET" && req.method !== "HEAD") return jsonOut({ error: "GET only" }, 405);
    const origin = await verifiedOrigin(req, host);
    if (!origin) return jsonOut({ error: "Could not tell which site this is." }, 400);
    return finishContentCheckout(req, { payments, origin, host });
  }

  return { checkout, checkoutReturn };
}
