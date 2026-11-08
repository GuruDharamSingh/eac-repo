import { createHash } from "node:crypto";
import { db } from "@elkdonis/db";
import { getOrderById } from "@elkdonis/commerce/queries";
import type { Address, Order } from "@elkdonis/commerce/types";
import {
  expireShippingLabelSession,
  refundShippingLabelPayment,
  resolveShippingPaymentRoute,
  startShippingLabelCheckout,
  startShippingPaymentCheckout,
  syncShippingPayment,
  type ShippingPaymentCheckoutInput,
  type ShippingPaymentRoute,
} from "@elkdonis/checkout/stripe";
import {
  buyLabel,
  cancelShipment,
  createShipment,
  EasyshipError,
  getShipment as getEsShipment,
  labelFacts,
  requestRates,
  type EasyshipMode,
  type EsShipment,
  type ShipmentSpec,
} from "./easyship";
import { destinationToEs, originToEs, packPiece, toEsParcel, type PackedParcel, type PieceForParcel } from "./parcel";
import { chooseOptions, daysLabel, priceFor, type ShippingOption } from "./rates";
import { getPacking, getShipFrom, markShipFromChecked, shipFromHash, type Packing, type ShipFrom } from "./settings";
import { notifyLabelFailed, notifyLabelReady, notifyShipThis, notifyTracking } from "./notices";

// ============================================================================
// Shipping after the sale: one `order_shipment` row per attempt (migration
// 251). Server only; callers check who may act (lib/shipping/actions.ts).
//
// QUOTE-ONLY (the flow in use, chosen_rate.flow = "quote"):
//   rated -> awaiting_payment -> paid -> in_transit (Katie typed the tracking)
//        \-> (test) paid directly, no Stripe, no ledger
// The buyer pays the quote to KATIE (Stripe metadata.kind "shipping_payment";
// the ledger is written with the payment, @elkdonis/commerce
// recordShippingPaymentPaid). No Easyship shipment and no label: Katie buys
// the label in her own account. On 'paid' she gets "Ship this order" once.
//
// Parked label flow (developer flag only, chosen_rate.flow absent):
//   rated -> awaiting_payment -> paid -> buying -> label_bought (-> label_pending)
//        \-> (test) paid directly, no Stripe     \-> failed (payment refunded)
//   label_bought -> in_transit -> delivered      (Easyship tracking webhook)
// The label is bought ONLY from 'paid', claimed atomically ('buying'), so a
// return hop, a page visit and a retry can never buy two labels.
// ============================================================================

export type ShipmentStatus =
  | "rated"
  | "awaiting_payment"
  | "paid"
  | "buying"
  | "label_pending"
  | "label_bought"
  | "in_transit"
  | "delivered"
  | "failed"
  | "cancelled"
  | "refunded";

export interface ChosenRate {
  courierServiceId: string;
  courier: string;
  service: string;
  minDays: number | null;
  maxDays: number | null;
  amountMinor: number;
  currency: string;
  /** "quote" = quote-only (Katie buys the label); absent = the parked label flow. */
  flow?: "quote";
  /** When Easyship quoted this price (the row's rated_at at the time of choosing). */
  quotedAt?: string | null;
  insured?: boolean;
  insuranceMinor?: number;
  /** Estimated import duty + tax the buyer pays at the door (US), minor units. */
  dutyMinor?: number;
}

export function isQuoteFlow(row: Pick<ShipmentRow, "chosenRate">): boolean {
  return row.chosenRate?.flow === "quote";
}

export interface ShipmentRow {
  id: string;
  orderId: string;
  mode: EasyshipMode;
  status: ShipmentStatus;
  shipFrom: ShipFrom;
  shipTo: Address;
  parcels: PackedParcel[];
  rates: { featured: ShippingOption[]; rest: ShippingOption[]; shipToHash?: string } | null;
  ratedAt: string | null;
  chosenRate: ChosenRate | null;
  insured: boolean;
  insuranceMinor: number | null;
  amountMinor: number | null;
  currency: string | null;
  easyshipShipmentId: string | null;
  stripeSessionId: string | null;
  stripePaymentIntent: string | null;
  paidMinor: number | null;
  paidAt: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  trackingStatus: string | null;
  labelUrl: string | null;
  labelCostMinor: number | null;
  labelCurrency: string | null;
  labelBoughtAt: string | null;
  refundReference: string | null;
  error: string | null;
  events: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));
const n = (v: unknown) => (v == null ? null : Number(v));

function mapRow(r: Row): ShipmentRow {
  return {
    id: String(r.id),
    orderId: String(r.order_id),
    mode: r.mode as EasyshipMode,
    status: r.status as ShipmentStatus,
    shipFrom: r.ship_from as ShipFrom,
    shipTo: r.ship_to as Address,
    parcels: (r.parcels as PackedParcel[]) ?? [],
    rates: (r.rates as ShipmentRow["rates"]) ?? null,
    ratedAt: r.rated_at ? new Date(r.rated_at as string).toISOString() : null,
    chosenRate: (r.chosen_rate as ChosenRate | null) ?? null,
    insured: Boolean(r.insured),
    insuranceMinor: n(r.insurance_minor),
    amountMinor: n(r.amount_minor),
    currency: s(r.currency)?.trim() ?? null,
    easyshipShipmentId: s(r.easyship_shipment_id),
    stripeSessionId: s(r.stripe_session_id),
    stripePaymentIntent: s(r.stripe_payment_intent),
    paidMinor: n(r.paid_minor),
    paidAt: r.paid_at ? new Date(r.paid_at as string).toISOString() : null,
    courierName: s(r.courier_name),
    trackingNumber: s(r.tracking_number),
    trackingUrl: s(r.tracking_url),
    trackingStatus: s(r.tracking_status),
    labelUrl: s(r.label_url),
    labelCostMinor: n(r.label_cost_minor),
    labelCurrency: s(r.label_currency)?.trim() ?? null,
    labelBoughtAt: r.label_bought_at ? new Date(r.label_bought_at as string).toISOString() : null,
    refundReference: s(r.refund_reference),
    error: s(r.error),
    events: (r.events as Array<Record<string, unknown>>) ?? [],
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

const ev = (kind: string, extra: Record<string, unknown> = {}) => db.json([{ at: new Date().toISOString(), kind, ...extra }] as never);

/** Rates are reused for this long before asking Easyship again (page views). */
const RATES_REUSE_MS = 30 * 60_000;
/** A chosen rate older than this is re-rated before charging. */
export const RATE_MAX_AGE_MS = 24 * 3600_000;

export const LABEL_STATES: ShipmentStatus[] = ["label_pending", "label_bought", "in_transit", "delivered"];
export const IN_FLIGHT: ShipmentStatus[] = ["awaiting_payment", "paid", "buying", ...LABEL_STATES];

export function shipToHash(a: Address): string {
  const k = [a.recipientName, a.line1, a.line2, a.city, a.region, a.postalCode, a.country, a.phone].map((x) => (x ?? "").trim().toLowerCase()).join("|");
  return createHash("sha256").update(k).digest("hex").slice(0, 16);
}

// ── reading ─────────────────────────────────────────────────────────────────

export async function getShipment(id: string): Promise<ShipmentRow | null> {
  const [r] = (await db`SELECT * FROM order_shipment WHERE id = ${id} LIMIT 1`) as unknown as Row[];
  return r ? mapRow(r) : null;
}

/** The shipment to show for an order in a mode: in flight or done first, else the latest. */
export async function currentShipment(orderId: string, mode: EasyshipMode): Promise<ShipmentRow | null> {
  const [r] = (await db`
    SELECT * FROM order_shipment WHERE order_id = ${orderId} AND mode = ${mode}
    ORDER BY (status = ANY(${IN_FLIGHT as string[]})) DESC, created_at DESC LIMIT 1
  `) as unknown as Row[];
  return r ? mapRow(r) : null;
}

/** For /manage/orders: the most relevant shipment per order (any mode). */
export async function shipmentsForOrders(orderIds: string[]): Promise<Map<string, ShipmentRow>> {
  const out = new Map<string, ShipmentRow>();
  if (orderIds.length === 0) return out;
  const rows = (await db`
    SELECT DISTINCT ON (order_id) * FROM order_shipment
    WHERE order_id = ANY(${orderIds}::uuid[]) AND status <> 'rated'
    ORDER BY order_id, (status = ANY(${IN_FLIGHT as string[]})) DESC, created_at DESC
  `) as unknown as Row[];
  for (const r of rows) out.set(String(r.order_id), mapRow(r));
  return out;
}

// ── the parcel(s) of an order ───────────────────────────────────────────────

export async function orderPieces(orderId: string): Promise<PieceForParcel[]> {
  const rows = (await db`
    SELECT a.id, a.title, a.medium, a.height_cm, a.width_cm, a.depth_cm, a.weight_kg, l.unit_price_minor, l.currency, l.quantity
    FROM commerce_order_line l JOIN artwork a ON a.id = l.artwork_id
    WHERE l.order_id = ${orderId}
    ORDER BY l.created_at
  `) as unknown as Row[];
  const out: PieceForParcel[] = [];
  for (const r of rows) {
    for (let i = 0; i < Math.max(1, Number(r.quantity) || 1); i++) {
      out.push({
        artworkId: String(r.id),
        title: String(r.title),
        medium: s(r.medium),
        heightCm: n(r.height_cm),
        widthCm: n(r.width_cm),
        depthCm: n(r.depth_cm),
        weightKg: n(r.weight_kg),
        price: (Number(r.unit_price_minor) || 0) / 100,
        currency: String(r.currency ?? "CAD").trim(),
      });
    }
  }
  return out;
}

export function packAll(pieces: PieceForParcel[], packing: Packing): { parcels: PackedParcel[]; problems: string[] } {
  const parcels: PackedParcel[] = [];
  const problems: string[] = [];
  for (const p of pieces) {
    const r = packPiece(p, packing);
    if ("problem" in r) problems.push(r.problem);
    else parcels.push(r);
  }
  if (pieces.length === 0) problems.push("This order has no pieces to ship.");
  return { parcels, problems };
}

function spec(origin: ShipFrom, to: Address, order: Pick<Order, "customerName" | "customerEmail" | "currency">, parcels: PackedParcel[], insured: boolean): ShipmentSpec {
  const declared = parcels.reduce((t, p) => t + p.declared, 0);
  return {
    origin: originToEs(origin),
    destination: destinationToEs(to, { name: order.customerName, email: order.customerEmail, phone: origin.phone, studioEmail: origin.email }),
    parcels: parcels.map(toEsParcel),
    insuredAmount: insured ? declared : null,
    currency: (order.currency || "CAD").toUpperCase(),
  };
}

// ── quotes ──────────────────────────────────────────────────────────────────

export type QuoteResult =
  | { ok: true; featured: ShippingOption[]; rest: ShippingOption[] }
  | { ok: false; kind: "address" | "parcel" | "setup" | "service"; message: string; details: string[] };

/** One rate request (insured for the declared value). Marks the ship-from as checked when it works. */
export async function quote(mode: EasyshipMode, origin: ShipFrom, to: Address, order: Pick<Order, "customerName" | "customerEmail" | "currency">, parcels: PackedParcel[]): Promise<QuoteResult> {
  try {
    const rates = await requestRates(mode, spec(origin, to, order, parcels, true));
    const { featured, rest } = chooseOptions(rates);
    // A quote that came back at all proves the ship-from is one Easyship accepts.
    await markShipFromChecked(shipFromHash(origin)).catch(() => undefined);
    if (featured.length === 0) {
      return { ok: false, kind: "address", message: "No carrier offered a price for this address.", details: [] };
    }
    return { ok: true, featured, rest };
  } catch (err) {
    return quoteError(err);
  }
}

function quoteError(err: unknown): QuoteResult & { ok: false } {
  if (err instanceof EasyshipError) {
    if (err.code === "not_configured") return { ok: false, kind: "setup", message: "Shipping is not connected yet.", details: [] };
    const d = err.details.join(" ");
    const isOrigin = /origin/i.test(d);
    if (err.status === 422 || err.status === 400) {
      if (/no shipping solutions/i.test(d)) {
        return { ok: false, kind: "address", message: "No carrier offered a price for this address.", details: err.details };
      }
      return {
        ok: false,
        kind: isOrigin ? "setup" : "address",
        message: isOrigin ? "The studio's ship-from address was refused." : "The carrier service couldn't use this address.",
        details: err.details.map((x) => x.replace(/destination_address\./g, "").replace(/origin_address\./g, "ship-from ")),
      };
    }
    console.error(`[katie-the-potter] Easyship ${err.status}:`, err.message);
  } else {
    console.error("[katie-the-potter] Easyship:", err);
  }
  return { ok: false, kind: "service", message: "The shipping service didn't answer.", details: [] };
}

export type RatesView =
  | { ok: true; row: ShipmentRow }
  | { ok: false; kind: "address" | "parcel" | "setup" | "service"; message: string; details: string[]; problems?: string[] };

/**
 * The rates to show on /orders/<id>/shipping: the order's 'rated' row,
 * reused while fresh (and for the same address), otherwise re-rated.
 */
export async function ratesForOrder(order: Order, mode: EasyshipMode, opts: { force?: boolean; actorUserId?: string | null; testWeightKg?: number | null } = {}): Promise<RatesView> {
  const origin = await getShipFrom();
  if (!origin) return { ok: false, kind: "setup", message: "The studio hasn't set its ship-from address yet.", details: [] };
  const to = order.shippingAddress;
  if (!to?.line1) return { ok: false, kind: "address", message: "This order has no shipping address yet.", details: [] };
  const hash = shipToHash(to);

  const [existing] = (await db`
    SELECT * FROM order_shipment WHERE order_id = ${order.id} AND mode = ${mode} AND status = 'rated'
    ORDER BY created_at DESC LIMIT 1
  `) as unknown as Row[];
  const ex = existing ? mapRow(existing) : null;
  if (
    ex &&
    !opts.force &&
    ex.rates?.shipToHash === hash &&
    ex.ratedAt &&
    Date.now() - new Date(ex.ratedAt).getTime() < RATES_REUSE_MS &&
    shipFromHash(ex.shipFrom) === shipFromHash(origin)
  ) {
    return { ok: true, row: ex };
  }

  // Test mode only: a typed weight stands in for pieces that have none (the
  // sample pieces), so the flow can be shown end to end. Never saved on the piece.
  const typed = opts.testWeightKg ?? (ex ? testWeightOf(ex) : null);
  const tw = mode === "test" && typed && typed > 0 && typed <= 30 ? typed : null;
  const pieces = (await orderPieces(order.id)).map((p) => (tw && !p.weightKg ? { ...p, weightKg: tw } : p));
  const { parcels, problems } = packAll(pieces, await getPacking());
  if (tw) for (const p of parcels) p.rule = `${p.rule} (test weight ${tw} kg)`;
  if (problems.length > 0) return { ok: false, kind: "parcel", message: "Some of this order can't be quoted automatically.", details: [], problems };

  const q = await quote(mode, origin, to, order, parcels);
  if (q.ok === false) return { ok: false, kind: q.kind, message: q.message, details: q.details };

  const rates = { featured: q.featured, rest: q.rest, shipToHash: hash };
  const rows = (ex
    ? await db`
        UPDATE order_shipment SET ship_from = ${db.json(origin as never)}, ship_to = ${db.json(to as never)},
          parcels = ${db.json(parcels as never)}, rates = ${db.json(rates as never)}, rated_at = NOW(),
          currency = ${order.currency}, events = events || ${ev("rated", { options: q.featured.length + q.rest.length })}, updated_at = NOW()
        WHERE id = ${ex.id} AND status = 'rated' RETURNING *`
    : await db`
        INSERT INTO order_shipment (order_id, mode, status, ship_from, ship_to, parcels, rates, rated_at, currency, created_by, events)
        VALUES (${order.id}, ${mode}, 'rated', ${db.json(origin as never)}, ${db.json(to as never)}, ${db.json(parcels as never)},
          ${db.json(rates as never)}, NOW(), ${order.currency}, ${opts.actorUserId ?? null}, ${ev("rated", { options: q.featured.length + q.rest.length })})
        RETURNING *`) as unknown as Row[];
  return rows[0] ? { ok: true, row: mapRow(rows[0]) } : { ok: false, kind: "service", message: "Please try again.", details: [] };
}

/** Test mode: the typed weight a row was rated with (kept in its parcel rule), so a re-rate uses it too. */
export function testWeightOf(row: Pick<ShipmentRow, "mode" | "parcels">): number | null {
  if (row.mode !== "test") return null;
  const m = row.parcels.map((p) => p.rule.match(/\(test weight ([\d.]+) kg\)/)).find(Boolean);
  const kg = m ? Number(m[1]) : NaN;
  return Number.isFinite(kg) && kg > 0 ? kg : null;
}

// ── choosing a rate ─────────────────────────────────────────────────────────

export type ChooseResult =
  | { ok: true; row: ShipmentRow }
  | { ok: false; message: string; changed?: { from: number; to: number; currency: string } };

/**
 * Lock in the buyer's choice: make the Easyship shipment for that courier
 * (free; no label yet) and set the amount to charge from what EASYSHIP says
 * that shipment costs. A rate older than 24 h is re-rated first. Any price
 * change is returned for the buyer to confirm before anything is charged
 * (`acceptMinor` = the price the buyer has seen and accepted).
 */
export async function chooseRate(input: {
  row: ShipmentRow;
  order: Order;
  courierServiceId: string;
  insured: boolean;
  acceptMinor: number;
  /** Quote-only: no Easyship shipment is made; the fresh quote is the price. */
  flow?: "quote" | "label";
}): Promise<ChooseResult> {
  let row = input.row;
  if (row.status !== "rated") return { ok: false, message: "This shipping choice was already made. Reload the page." };
  const all = [...(row.rates?.featured ?? []), ...(row.rates?.rest ?? [])];
  let opt = all.find((o) => o.courierServiceId === input.courierServiceId);
  if (!opt) return { ok: false, message: "Choose one of the options shown." };
  const quoteFlow = input.flow === "quote";

  // Re-rate when the quote is old. Quote-only has no shipment to re-price
  // it, so the quote itself must be fresh (the page's 30-minute reuse).
  const maxAge = quoteFlow ? RATES_REUSE_MS : RATE_MAX_AGE_MS;
  if (!row.ratedAt || Date.now() - new Date(row.ratedAt).getTime() > maxAge) {
    const fresh = await ratesForOrder(input.order, row.mode, { force: true, testWeightKg: testWeightOf(row) });
    if (fresh.ok === false) return { ok: false, message: `${fresh.message} ${fresh.details.join(" ")}`.trim() };
    row = fresh.row;
    const again = [...(row.rates?.featured ?? []), ...(row.rates?.rest ?? [])].find((o) => o.courierServiceId === input.courierServiceId);
    if (!again) return { ok: false, message: "That option is no longer offered. Please choose again." };
    opt = again;
  }

  const shown = priceFor(opt, input.insured);
  if (shown !== input.acceptMinor) {
    return { ok: false, message: "The price changed since you looked.", changed: { from: input.acceptMinor, to: shown, currency: opt.currency } };
  }

  if (quoteFlow) {
    // Quote-only: nothing is created with Easyship. The choice and the quote
    // it rests on are kept on the row (and go to Stripe and to Katie).
    const chosen: ChosenRate = {
      courierServiceId: opt.courierServiceId,
      courier: opt.courier,
      service: opt.service,
      minDays: opt.minDays,
      maxDays: opt.maxDays,
      amountMinor: shown,
      currency: opt.currency,
      flow: "quote",
      quotedAt: row.ratedAt,
      insured: input.insured,
      insuranceMinor: input.insured ? opt.insuranceMinor : 0,
      dutyMinor: opt.dutyMinor + opt.taxMinor,
    };
    const rows = (await db`
      UPDATE order_shipment SET chosen_rate = ${db.json(chosen as never)}, insured = ${input.insured},
        insurance_minor = ${input.insured ? opt.insuranceMinor : 0}, amount_minor = ${shown}, currency = ${opt.currency},
        easyship_shipment_id = NULL, courier_name = ${opt.service},
        events = events || ${ev("chosen", { flow: "quote", courierServiceId: opt.courierServiceId, amountMinor: shown, insured: input.insured, quotedAt: row.ratedAt })},
        updated_at = NOW()
      WHERE id = ${row.id} AND status = 'rated' RETURNING *
    `) as unknown as Row[];
    if (!rows[0]) return { ok: false, message: "This shipping choice was already made. Reload the page." };
    return { ok: true, row: mapRow(rows[0]) };
  }

  // A shipment left from an earlier, abandoned choice is dropped first.
  if (row.easyshipShipmentId) await cancelShipment(row.mode, row.easyshipShipmentId, false).catch(() => undefined);

  // The shipment, for exactly this courier; its own rate is the price we charge.
  let es: EsShipment;
  try {
    const order = input.order;
    es = await createShipment(row.mode, {
      ...spec(row.shipFrom, row.shipTo, order, row.parcels, input.insured),
      courierServiceId: opt.courierServiceId,
      reference: `${order.number}${row.mode === "test" ? " TEST" : ""}`,
    });
  } catch (err) {
    const q = quoteError(err);
    return { ok: false, message: `${q.message} ${q.details.join(" ")}`.trim() };
  }
  const esRate = (es.rates ?? []).find((r) => r.courier_service?.id === opt.courierServiceId) ?? (es.rates ?? [])[0];
  const charged = esRate ? Math.round(Number(esRate.total_charge) * 100) : shown;
  if (charged !== shown) {
    await cancelShipment(row.mode, es.easyship_shipment_id, false).catch(() => undefined);
    // Keep the newer price on the row so the page shows it.
    const patched = all.map((o) =>
      o.courierServiceId === opt.courierServiceId
        ? { ...o, insuredMinor: input.insured ? charged : charged + o.insuranceMinor, uninsuredMinor: input.insured ? Math.max(0, charged - o.insuranceMinor) : charged }
        : o
    );
    const featured = patched.filter((o) => row.rates?.featured.some((f) => f.courierServiceId === o.courierServiceId));
    const rest = patched.filter((o) => !featured.includes(o));
    await db`UPDATE order_shipment SET rates = ${db.json({ ...row.rates, featured, rest } as never)}, updated_at = NOW() WHERE id = ${row.id}`;
    return { ok: false, message: "The carrier's price changed.", changed: { from: shown, to: charged, currency: opt.currency } };
  }

  const chosen: ChosenRate = {
    courierServiceId: opt.courierServiceId,
    courier: opt.courier,
    service: opt.service,
    minDays: opt.minDays,
    maxDays: opt.maxDays,
    amountMinor: charged,
    currency: opt.currency,
  };
  const rows = (await db`
    UPDATE order_shipment SET chosen_rate = ${db.json(chosen as never)}, insured = ${input.insured},
      insurance_minor = ${input.insured ? opt.insuranceMinor : 0}, amount_minor = ${charged}, currency = ${opt.currency},
      easyship_shipment_id = ${es.easyship_shipment_id}, courier_name = ${opt.service},
      events = events || ${ev("chosen", { courierServiceId: opt.courierServiceId, amountMinor: charged, insured: input.insured, easyship: es.easyship_shipment_id })},
      updated_at = NOW()
    WHERE id = ${row.id} AND status = 'rated' RETURNING *
  `) as unknown as Row[];
  if (!rows[0]) {
    await cancelShipment(row.mode, es.easyship_shipment_id, false).catch(() => undefined);
    return { ok: false, message: "This shipping choice was already made. Reload the page." };
  }
  return { ok: true, row: mapRow(rows[0]) };
}

/** The one line on Stripe's page: "Shipping: Canpar Ground, 1 business day (insured)". */
export function labelLineName(c: ChosenRate, insured: boolean): string {
  return `Shipping: ${c.service}, ${daysLabel(c)}${insured ? " (insured)" : ""}`;
}

// ── quote-only: the buyer pays Katie for shipping ───────────────────────────

const parcelFacts = (parcels: PackedParcel[]) => parcels.map((p) => `${p.lengthCm}x${p.widthCm}x${p.heightCm}cm ${p.weightKg}kg`).join("; ");
const estDays = (c: Pick<ChosenRate, "minDays" | "maxDays">) =>
  c.minDays == null && c.maxDays == null ? "" : c.minDays != null && c.maxDays != null && c.minDays !== c.maxDays ? `${c.minDays}-${c.maxDays}` : String(c.maxDays ?? c.minDays);

/**
 * Everything the shipping Checkout carries, from the row: the line, its
 * description, the quote and the route. Pure apart from what it is given, so
 * scripts/shipping-quote-check.ts builds the exact params without Stripe.
 */
export function shippingPaymentInput(row: ShipmentRow, order: Order, origin: string, route: ShippingPaymentRoute): ShippingPaymentCheckoutInput {
  const c = row.chosenRate;
  if (!c || !row.amountMinor || !row.currency) throw new Error("Choose a shipping option first.");
  const quoted = c.quotedAt ?? row.ratedAt ?? null;
  return {
    shipmentId: row.id,
    orderId: order.id,
    orderNumber: order.number,
    customerEmail: order.customerEmail,
    lineName: labelLineName(c, row.insured),
    lineDescription: `Order ${order.number}. Katie packs and ships it, then emails you the tracking. Easyship quote${quoted ? ` of ${quoted.slice(0, 16).replace("T", " ")} UTC` : ""}; parcel ${parcelFacts(row.parcels).replace(/x/g, "×")}.`,
    amountMinor: row.amountMinor,
    currency: row.currency,
    successUrl: `${origin}/api/shipping/return?shipment=${row.id}`,
    cancelUrl: `${origin}/orders/${order.id}/shipping?cancelled=1`,
    route,
    quote: {
      courierServiceId: c.courierServiceId,
      courier: c.courier,
      service: c.service,
      estDays: estDays(c),
      quotedAt: quoted ?? "",
      insured: row.insured,
      parcel: parcelFacts(row.parcels),
      shipToCountry: (row.shipTo?.country ?? "").toUpperCase(),
    },
  };
}

/**
 * Live quote-only: open the shipping Checkout (Katie's money: a destination
 * charge to her account when she can take one, else a platform charge the
 * ledger owes her). Real Stripe object; never called in test.
 */
export async function startShippingPayment(row: ShipmentRow, order: Order, origin: string): Promise<string> {
  if (row.mode !== "live") throw new Error("Test shipments never open a Stripe payment.");
  if (!isQuoteFlow(row)) throw new Error("Not a quote-only shipment.");
  if (row.stripeSessionId) await expireShippingLabelSession(row.stripeSessionId).catch(() => undefined);
  const route = await resolveShippingPaymentRoute(order.id);
  const s = await startShippingPaymentCheckout(shippingPaymentInput(row, order, origin, route));
  await markAwaitingPayment(row.id, s.sessionId, route);
  return s.url;
}

/** The session is open: rated -> awaiting_payment, with its id and route. (The check script calls this with a fake id.) */
export async function markAwaitingPayment(shipmentId: string, sessionId: string, route: ShippingPaymentRoute): Promise<boolean> {
  const r = (await db`
    UPDATE order_shipment SET status = 'awaiting_payment', stripe_session_id = ${sessionId},
      events = events || ${ev("payment_started", { sessionId, route: route.destinationAccountId ? "destination" : "platform", payTo: route.payToUserId })}, updated_at = NOW()
    WHERE id = ${shipmentId} AND status IN ('rated', 'awaiting_payment') RETURNING id
  `) as unknown as Row[];
  return r.length > 0;
}

/** Quote Test only: skip the payment (no Stripe, no ledger) so the rest can be rehearsed. */
export async function markQuoteTestPaid(row: ShipmentRow): Promise<boolean> {
  if (row.mode !== "test" || !isQuoteFlow(row)) return false;
  const r = (await db`
    UPDATE order_shipment SET status = 'paid', paid_minor = amount_minor, paid_at = NOW(),
      events = events || ${ev("paid", { source: "test mode: payment skipped, no ledger" })}, updated_at = NOW()
    WHERE id = ${row.id} AND mode = 'test' AND status = 'rated' AND chosen_rate IS NOT NULL
    RETURNING id
  `) as unknown as Row[];
  return r.length > 0;
}

/** Once per shipment: append an event kind if it is not there yet. True when this call added it. */
async function claimOnce(id: string, kind: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  const r = (await db`
    UPDATE order_shipment SET events = events || ${ev(kind, extra)}, updated_at = NOW()
    WHERE id = ${id} AND NOT (events @> ${db.json([{ kind }] as never)}) RETURNING id
  `) as unknown as Row[];
  return r.length > 0;
}

/** A quote-only shipment just got paid: tell Katie what to ship (once). */
export async function ensureShipThisNotice(row: ShipmentRow): Promise<ShipmentRow> {
  if (row.status !== "paid" || !isQuoteFlow(row)) return row;
  if (!(await claimOnce(row.id, "ship_this_notice"))) return row;
  await notifyShipThis(row).catch((err) => console.error(`[katie-the-potter] notifyShipThis ${row.id}:`, err));
  return (await getShipment(row.id)) ?? row;
}

/** Common carriers' public tracking pages (quote-only: Katie types the carrier and number). */
export function trackingUrlFor(carrier: string, n: string): string | null {
  const c = carrier.toLowerCase();
  const q = encodeURIComponent(n.trim());
  if (!q) return null;
  if (/canada post|postes canada/.test(c)) return `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${q}`;
  if (/purolator/.test(c)) return `https://www.purolator.com/en/shipping/tracker?pin=${q}`;
  if (/ups/.test(c)) return `https://www.ups.com/track?tracknum=${q}`;
  if (/fedex/.test(c)) return `https://www.fedex.com/fedextrack/?trknbr=${q}`;
  if (/dhl/.test(c)) return `https://www.dhl.com/ca-en/home/tracking.html?tracking-id=${q}`;
  if (/canpar/.test(c)) return `https://www.canpar.com/en/tracking/delivery_options.htm?barcode=${q}`;
  if (/usps/.test(c)) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${q}`;
  return null;
}

/**
 * Katie bought the label herself and typed the tracking: paid -> in_transit,
 * the buyer gets the tracking email (test mode: logged). Returns the row, or a
 * message when it can't.
 */
export async function recordKatieShipped(
  row: ShipmentRow,
  input: { carrier: string; trackingNumber: string; actorUserId: string | null }
): Promise<{ ok: true; row: ShipmentRow } | { ok: false; message: string }> {
  if (!isQuoteFlow(row)) return { ok: false, message: "This shipment's label is bought here; use its own tracking." };
  if (row.status !== "paid") return { ok: false, message: row.status === "in_transit" || row.status === "delivered" ? "Already marked shipped." : "The buyer hasn't paid for shipping yet." };
  const carrier = input.carrier.trim().slice(0, 80);
  const tn = input.trackingNumber.replace(/\s+/g, "").slice(0, 60);
  if (!carrier) return { ok: false, message: "Add the carrier (for example Canada Post)." };
  if (!/^[A-Za-z0-9-]{6,60}$/.test(tn)) return { ok: false, message: "That tracking number doesn't look right: letters and digits, at least 6." };
  const url = trackingUrlFor(carrier, tn);
  const rows = (await db`
    UPDATE order_shipment SET status = 'in_transit', courier_name = ${carrier}, tracking_number = ${tn}, tracking_url = ${url},
      tracking_status = 'Shipped', events = events || ${ev("shipped_by_katie", { carrier, trackingNumber: tn, by: input.actorUserId })}, updated_at = NOW()
    WHERE id = ${row.id} AND status = 'paid' RETURNING *
  `) as unknown as Row[];
  if (!rows[0]) return { ok: false, message: "Already marked shipped. Reload the page." };
  const done = mapRow(rows[0]);
  await notifyTracking(done).catch((err) => console.error(`[katie-the-potter] notifyTracking ${row.id}:`, err));
  return { ok: true, row: (await getShipment(row.id)) ?? done };
}

/** (Parked label flow) Live: open the label-payment Checkout. Real Stripe object; never called in test. */
export async function startLabelPayment(row: ShipmentRow, order: Order, origin: string): Promise<string> {
  if (row.mode !== "live") throw new Error("Test shipments never open a Stripe payment.");
  if (!row.chosenRate || !row.amountMinor || !row.currency) throw new Error("Choose a shipping option first.");
  if (row.stripeSessionId) await expireShippingLabelSession(row.stripeSessionId).catch(() => undefined);
  const s = await startShippingLabelCheckout({
    shipmentId: row.id,
    orderId: order.id,
    orderNumber: order.number,
    customerEmail: order.customerEmail,
    lineName: labelLineName(row.chosenRate, row.insured),
    amountMinor: row.amountMinor,
    currency: row.currency,
    successUrl: `${origin}/api/shipping/return?shipment=${row.id}`,
    cancelUrl: `${origin}/orders/${order.id}/shipping?cancelled=1`,
  });
  await db`
    UPDATE order_shipment SET status = 'awaiting_payment', stripe_session_id = ${s.sessionId},
      events = events || ${ev("payment_started", { sessionId: s.sessionId })}, updated_at = NOW()
    WHERE id = ${row.id} AND status IN ('rated', 'awaiting_payment')
  `;
  return s.url;
}

/**
 * "Choose a different option" while a payment is open: close the Stripe
 * session, drop the Easyship shipment, back to rated. Refuses (returns the
 * row unchanged) once the payment has cleared.
 */
export async function reopenChoice(row: ShipmentRow): Promise<ShipmentRow> {
  let r = row;
  if (r.status === "awaiting_payment") r = await syncLabelPayment(r);
  if (r.status !== "awaiting_payment" && r.status !== "rated") return r;
  if (r.stripeSessionId) await expireShippingLabelSession(r.stripeSessionId).catch(() => undefined);
  if (r.easyshipShipmentId) await cancelShipment(r.mode, r.easyshipShipmentId, false).catch(() => undefined);
  const rows = (await db`
    UPDATE order_shipment SET status = 'rated', stripe_session_id = NULL, easyship_shipment_id = NULL, chosen_rate = NULL,
      amount_minor = NULL, events = events || ${ev("reopened")}, updated_at = NOW()
    WHERE id = ${r.id} AND status IN ('rated', 'awaiting_payment') RETURNING *
  `) as unknown as Row[];
  return rows[0] ? mapRow(rows[0]) : r;
}

/** Back from Stripe (or a visit while awaiting payment): read the session, record it. */
export async function syncLabelPayment(row: ShipmentRow): Promise<ShipmentRow> {
  if (row.mode !== "live" || row.status !== "awaiting_payment" || !row.stripeSessionId) return row;
  try {
    // Both kinds: quote-only records the ledger with the payment (shared path).
    await syncShippingPayment({ shipmentId: row.id, sessionId: row.stripeSessionId });
  } catch (err) {
    console.error(`[katie-the-potter] syncLabelPayment ${row.id}:`, err);
  }
  return (await getShipment(row.id)) ?? row;
}

/** Test mode only: skip the payment entirely and go straight to 'paid'. */
export async function markTestPaid(row: ShipmentRow): Promise<boolean> {
  if (row.mode !== "test") return false;
  const r = (await db`
    UPDATE order_shipment SET status = 'paid', paid_minor = 0, paid_at = NOW(),
      events = events || ${ev("paid", { source: "test mode: payment skipped" })}, updated_at = NOW()
    WHERE id = ${row.id} AND mode = 'test' AND status = 'rated' AND easyship_shipment_id IS NOT NULL
    RETURNING id
  `) as unknown as Row[];
  return r.length > 0;
}

// ── buying the label ────────────────────────────────────────────────────────

function costOf(s: EsShipment, courierServiceId: string | null): { minor: number | null; currency: string | null } {
  const r = (s.rates ?? []).find((x) => x.courier_service?.id === courierServiceId) ?? (s.rates ?? [])[0];
  return r ? { minor: Math.round(Number(r.total_charge) * 100), currency: (r.currency || s.currency || "").toUpperCase() || null } : { minor: null, currency: null };
}

/**
 * Buy the label for a PAID shipment. Claims it first ('paid' -> 'buying'),
 * so only one caller ever buys. Tries twice; if both fail the label payment is
 * refunded in full (live) and Katie is told to arrange it.
 */
export async function ensureLabel(shipmentId: string): Promise<ShipmentRow | null> {
  const claimed = (await db`
    UPDATE order_shipment SET status = 'buying', events = events || ${ev("buying")}, updated_at = NOW()
    WHERE id = ${shipmentId} AND status = 'paid' AND easyship_shipment_id IS NOT NULL RETURNING *
  `) as unknown as Row[];
  if (!claimed[0]) return getShipment(shipmentId);
  const row = mapRow(claimed[0]);

  let bought: EsShipment | null = null;
  let lastErr = "";
  for (let attempt = 0; attempt < 2 && !bought; attempt++) {
    try {
      bought = await buyLabel(row.mode, row.easyshipShipmentId!, row.chosenRate?.courierServiceId ?? null);
    } catch (err) {
      lastErr = err instanceof EasyshipError ? `${err.status} ${err.details.join("; ") || err.message}` : String(err);
      console.error(`[katie-the-potter] buyLabel ${row.id} attempt ${attempt + 1}:`, lastErr);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 2500));
    }
  }

  if (!bought) return failLabel(row, lastErr);

  const f = labelFacts(bought);
  const cost = costOf(bought, row.chosenRate?.courierServiceId ?? null);
  const status: ShipmentStatus = f.labelUrl ? "label_bought" : "label_pending";
  const rows = (await db`
    UPDATE order_shipment SET status = ${status}, label_url = ${f.labelUrl}, tracking_number = ${f.trackingNumber},
      tracking_url = ${f.trackingUrl}, courier_name = COALESCE(${bought.courier_service?.name ?? null}, courier_name),
      label_cost_minor = ${cost.minor}, label_currency = ${cost.currency}, label_bought_at = NOW(), error = NULL,
      events = events || ${ev("label", { labelState: bought.label_state ?? null, costMinor: cost.minor })}, updated_at = NOW()
    WHERE id = ${row.id} RETURNING *
  `) as unknown as Row[];
  const done = rows[0] ? mapRow(rows[0]) : row;
  await notifyLabelReady(done).catch((err) => console.error(`[katie-the-potter] notifyLabelReady ${row.id}:`, err));
  return done;
}

async function failLabel(row: ShipmentRow, reason: string): Promise<ShipmentRow | null> {
  let refundRef: string | null = null;
  let refunded = false;
  if (row.mode === "live" && row.stripePaymentIntent && row.paidMinor && row.paidMinor > 0) {
    try {
      const r = await refundShippingLabelPayment({
        shipmentId: row.id,
        paymentIntentId: row.stripePaymentIntent,
        amountMinor: row.paidMinor,
        currency: row.currency ?? "CAD",
        reason: "Shipping label could not be bought",
      });
      refundRef = r.refundReference;
      refunded = true;
    } catch (err) {
      console.error(`[katie-the-potter] refund label payment ${row.id}:`, err);
    }
  }
  // Undo the Easyship shipment so nothing is left half-made.
  if (row.easyshipShipmentId) await cancelShipment(row.mode, row.easyshipShipmentId, true).catch(() => cancelShipment(row.mode, row.easyshipShipmentId!, false).catch(() => undefined));
  const rows = (await db`
    UPDATE order_shipment SET status = ${refunded || row.mode === "test" ? "refunded" : "failed"}, refund_reference = ${refundRef},
      error = ${reason.slice(0, 500)}, events = events || ${ev("label_failed", { reason: reason.slice(0, 300), refunded })}, updated_at = NOW()
    WHERE id = ${row.id} RETURNING *
  `) as unknown as Row[];
  const out = rows[0] ? mapRow(rows[0]) : row;
  await notifyLabelFailed(out, refunded).catch((err) => console.error(`[katie-the-potter] notifyLabelFailed ${row.id}:`, err));
  return out;
}

/** A label still being made: ask Easyship again. */
export async function refreshPendingLabel(row: ShipmentRow): Promise<ShipmentRow> {
  if (row.status !== "label_pending" || !row.easyshipShipmentId) return row;
  try {
    const es = await getEsShipment(row.mode, row.easyshipShipmentId);
    const f = labelFacts(es);
    if (!f.labelUrl) return row;
    const rows = (await db`
      UPDATE order_shipment SET status = 'label_bought', label_url = ${f.labelUrl},
        tracking_number = COALESCE(${f.trackingNumber}, tracking_number), tracking_url = COALESCE(${f.trackingUrl}, tracking_url),
        events = events || ${ev("label_ready")}, updated_at = NOW()
      WHERE id = ${row.id} AND status = 'label_pending' RETURNING *
    `) as unknown as Row[];
    if (rows[0]) {
      const done = mapRow(rows[0]);
      await notifyLabelReady(done).catch(() => undefined);
      return done;
    }
  } catch (err) {
    console.error(`[katie-the-potter] refreshPendingLabel ${row.id}:`, err);
  }
  return row;
}

/**
 * Whatever is owed to this shipment right now (idempotent; safe on any page
 * view): a payment to read back from Stripe, a label to buy, a label document
 * to fetch.
 */
export async function advance(row: ShipmentRow): Promise<ShipmentRow> {
  let r = row;
  if (r.status === "awaiting_payment") r = await syncLabelPayment(r);
  // Quote-only: no label to buy; Katie is told once what to ship.
  if (r.status === "paid" && isQuoteFlow(r)) return ensureShipThisNotice(r);
  if (r.status === "paid") r = (await ensureLabel(r.id)) ?? r;
  if (r.status === "label_pending") r = await refreshPendingLabel(r);
  return r;
}

// ── addresses, tracking, cleanup ────────────────────────────────────────────

/**
 * The buyer corrects their address (before anything is bought). The order's
 * own address is updated so Katie sees the same one; the old one is kept in
 * the shipment's event log. Rates are asked for again.
 */
export async function correctShipTo(order: Order, mode: EasyshipMode, a: Address): Promise<void> {
  await db`UPDATE commerce_order SET shipping_address = ${db.json(a as never)}, updated_at = NOW() WHERE id = ${order.id}`;
  await db`
    UPDATE order_shipment SET status = 'cancelled', events = events || ${ev("address_corrected", { before: order.shippingAddress ?? null })}, updated_at = NOW()
    WHERE order_id = ${order.id} AND mode = ${mode} AND status = 'rated'
  `;
}

/** Easyship's tracking words -> our status (only ever forward). */
export function statusFromTracking(words: string): ShipmentStatus | null {
  const w = words.toLowerCase();
  if (w === "delivered") return "delivered";
  if (/in transit|out for delivery|shipped|consolidation|failed delivery|exception|delivery expected|no recent/.test(w)) return "in_transit";
  return null;
}

export async function applyTracking(input: {
  easyshipShipmentId: string;
  status?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  labelUrl?: string | null;
  eventType: string;
}): Promise<ShipmentRow | null> {
  const [r] = (await db`
    SELECT * FROM order_shipment WHERE easyship_shipment_id = ${input.easyshipShipmentId}
    ORDER BY created_at DESC LIMIT 1
  `) as unknown as Row[];
  if (!r) return null;
  const row = mapRow(r);
  let next: ShipmentStatus = row.status;
  const order: ShipmentStatus[] = ["label_pending", "label_bought", "in_transit", "delivered"];
  let words = input.status ?? null;
  if (input.eventType === "shipment.tracking.status.changed" && input.status) {
    const t = statusFromTracking(input.status);
    if (t && order.includes(row.status) && order.indexOf(t) > order.indexOf(row.status)) next = t;
    // A late, older event keeps the newer words.
    if (t && order.includes(row.status) && order.indexOf(t) < order.indexOf(row.status)) words = null;
  }
  if (input.eventType === "shipment.label.created" && row.status === "label_pending" && input.labelUrl) next = "label_bought";
  if (input.eventType === "shipment.cancelled" && !["delivered", "in_transit"].includes(row.status)) next = "cancelled";
  const rows = (await db`
    UPDATE order_shipment SET status = ${next},
      tracking_status = COALESCE(${words}, tracking_status),
      tracking_number = COALESCE(${input.trackingNumber ?? null}, tracking_number),
      tracking_url = COALESCE(${input.trackingUrl ?? null}, tracking_url),
      label_url = COALESCE(label_url, ${input.labelUrl ?? null}),
      events = events || ${ev("easyship", { type: input.eventType, status: input.status ?? null })}, updated_at = NOW()
    WHERE id = ${row.id} RETURNING *
  `) as unknown as Row[];
  const out = rows[0] ? mapRow(rows[0]) : row;
  if (row.status === "label_pending" && out.status === "label_bought") await notifyLabelReady(out).catch(() => undefined);
  return out;
}

/** Cancel a shipment (and its label with Easyship, when it has one). Used by cleanup and "Void label". */
export async function cancelShipmentRow(row: ShipmentRow, reason: string): Promise<ShipmentRow> {
  const labelRequested = (LABEL_STATES as string[]).includes(row.status) || row.status === "buying";
  let note = "";
  if (row.easyshipShipmentId) {
    try {
      await cancelShipment(row.mode, row.easyshipShipmentId, labelRequested);
    } catch (err) {
      note = err instanceof Error ? err.message : String(err);
    }
  }
  const rows = (await db`
    UPDATE order_shipment SET status = 'cancelled', error = ${note || null},
      events = events || ${ev("cancelled", { reason, easyship: note || "ok" })}, updated_at = NOW()
    WHERE id = ${row.id} RETURNING *
  `) as unknown as Row[];
  return rows[0] ? mapRow(rows[0]) : row;
}

export async function reloadOrder(orderId: string): Promise<Order | null> {
  return getOrderById(orderId);
}
