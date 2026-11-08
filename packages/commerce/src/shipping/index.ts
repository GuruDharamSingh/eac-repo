// ============================================================================
// Shipping for marketplace orders (migration 250). Server only.
//
// Model (developer, 2026-11-07):
//   * Ship-from is the maker's (`users.ship_from`); the parcel is the
//     artwork's packed size (`artwork.parcel`, else derived from its own
//     dimensions with a packing allowance).
//   * The store's `shipping_mode` (set by a network admin) decides who buys
//     the label: `quote` → the seller, `platform` → the collective on its
//     Easyship account, `arranged` → nobody here (no quote, as before).
//   * The buyer picks a rate on the order page before paying. It sets
//     `commerce_order.shipping_minor` and the total.
//   * The collective holds the shipping money either way: in quote mode it
//     accrues to the maker held `awaiting_tracking` and is released when the
//     seller records tracking; in platform mode it accrues to the platform
//     and pays for the label. See `accrueOrderShipping`.
// ============================================================================

import { db } from "@elkdonis/db";
import type { Address } from "../types";
import { jsonb, num, type Row } from "../server/map-order";
import { writeEntry } from "../server/ledger";
import {
  EasyshipError,
  createShipmentWithLabel,
  easyshipEnv,
  isEasyshipConfigured,
  requestRates,
  type EasyshipAddress,
  type EasyshipParcelInput,
  type EasyshipRate,
} from "./easyship";

export { isEasyshipConfigured, easyshipEnv, EasyshipError } from "./easyship";

export type ShippingMode = "quote" | "platform" | "arranged";
export const SHIPPING_MODES: ShippingMode[] = ["quote", "platform", "arranged"];

/** Where a maker ships from. Easyship requires phone and email on the origin. */
export interface ShipFrom extends Address {
  company?: string | null;
  email: string;
}

export interface Parcel {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  /** Customs tariff code. Defaults by artwork kind (see `hsCodeFor`). */
  hsCode?: string | null;
}

export interface ShippingOption {
  /** Easyship courier service id. */
  id: string;
  name: string;
  courier: string;
  amountMinor: number;
  currency: string;
  minDays: number | null;
  maxDays: number | null;
  /** Estimates the buyer pays the courier on delivery (DDU). Minor units. */
  importDutyMinor: number;
  importTaxMinor: number;
}

/** What the buyer chose, kept on `commerce_order.metadata.shipping`. */
export interface OrderShipping {
  mode: ShippingMode;
  /** `arranged`: buyer and seller sort it out; amount 0. */
  method: "courier" | "arranged";
  option: ShippingOption | null;
  address: Address;
  chosenAt: string;
  env: "sandbox" | "production";
}

/** Flat on purpose: art-auction compiles with `strict: false`, where unions do not narrow. */
export type Result<T = object> = { ok: boolean; error?: string } & Partial<T>;

const UNPAID = ["draft", "pending_payment", "awaiting_etransfer"];

// Services a courier offers that are not allowed for artwork.
const EXCLUDED_SERVICE = /\bmedia\b/i; // USPS Media Mail: books and recorded media only

const toMinor = (major: number | null | undefined) => Math.round(Number(major ?? 0) * 100);

// ---------------------------------------------------------------------------
// Ship-from (maker) and parcel (artwork)
// ---------------------------------------------------------------------------

export async function getShipFrom(userId: string): Promise<ShipFrom | null> {
  const [r] = (await db`SELECT ship_from FROM users WHERE id = ${userId} LIMIT 1`) as unknown as Row[];
  return (r?.ship_from as ShipFrom | null) ?? null;
}

export async function setShipFrom(userId: string, value: ShipFrom | null): Promise<Result> {
  if (value) {
    const v = value;
    const missing = (["recipientName", "line1", "city", "postalCode", "country", "phone", "email"] as const).filter(
      (k) => !String(v[k] ?? "").trim()
    );
    if (missing.length) return { ok: false, error: `Missing: ${missing.join(", ")}.` };
    if (!/^[A-Z]{2}$/.test(value.country.trim().toUpperCase())) {
      return { ok: false, error: "Country must be a two-letter code (CA, US, FR…)." };
    }
    value = { ...value, country: value.country.trim().toUpperCase() };
  }
  await db`UPDATE users SET ship_from = ${value ? jsonb(value) : null} WHERE id = ${userId}`;
  return { ok: true };
}

/** Validates and stores a packed parcel on an artwork. Access is the caller's. */
export async function setArtworkParcel(artworkId: string, parcel: Parcel | null): Promise<Result> {
  if (parcel) {
    const nums = [parcel.lengthCm, parcel.widthCm, parcel.heightCm, parcel.weightKg];
    if (nums.some((n) => !Number.isFinite(n) || n <= 0 || n > 1000)) {
      return { ok: false, error: "Enter the packed length, width, height (cm) and weight (kg)." };
    }
  }
  await db`UPDATE artwork SET parcel = ${parcel ? jsonb(parcel) : null} WHERE id = ${artworkId}`;
  return { ok: true };
}

function hsCodeFor(kind: string | null, medium: string | null): string {
  if (kind === "open_edition" || kind === "limited_edition") return "49119100"; // printed pictures
  if (medium && /sculpt|bronze|ceramic|clay/i.test(medium)) return "97030000"; // original sculpture
  return "97011000"; // paintings, drawings, pastels, executed entirely by hand
}

/** The artwork's packed parcel, or one derived from its own size (+8 cm a side, +1.5 kg). */
function parcelFor(a: Row): Parcel | null {
  const p = a.parcel as Parcel | null;
  if (p && p.lengthCm && p.widthCm && p.heightCm && p.weightKg) return p;
  const h = num(a.height_cm), w = num(a.width_cm), d = num(a.depth_cm), kg = num(a.weight_kg);
  if (!h || !w) return null;
  return {
    lengthCm: Math.ceil(Math.max(h, w) + 8),
    widthCm: Math.ceil(Math.min(h, w) + 8),
    heightCm: Math.ceil((d || 3) + 8),
    weightKg: Math.round(((kg || 1) + 1.5) * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// What an order needs
// ---------------------------------------------------------------------------

interface OrderContext {
  order: Row;
  mode: ShippingMode;
  makerUserId: string | null;
  origin: ShipFrom | null;
  parcels: Array<{ parcel: Parcel; description: string; hsCode: string; valueMinor: number }>;
  /** Why no quote can be given, when `canQuote` is false. */
  reason: string | null;
  canQuote: boolean;
}

async function loadContext(orderId: string): Promise<OrderContext | null> {
  const [order] = (await db`
    SELECT o.*, s.shipping_mode
    FROM commerce_order o
    LEFT JOIN store s ON s.id = o.store_id
    WHERE o.id = ${orderId} LIMIT 1
  `) as unknown as Row[];
  if (!order) return null;
  const mode = ((order.shipping_mode as string | null) ?? "arranged") as ShippingMode;

  const lines = (await db`
    SELECT l.artist_user_id, l.description, l.unit_price_minor, l.quantity,
           a.id AS artwork_id, a.kind, a.medium, a.parcel,
           a.height_cm, a.width_cm, a.depth_cm, a.weight_kg, a.artist_user_id AS a_maker
    FROM commerce_order_line l
    LEFT JOIN artwork a ON a.id = l.artwork_id
    WHERE l.order_id = ${orderId}
    ORDER BY l.created_at
  `) as unknown as Row[];

  const artLines = lines.filter((l) => l.artwork_id);
  const makers = new Set(artLines.map((l) => (l.artist_user_id ?? l.a_maker ?? null) as string | null));
  const makerUserId = makers.size === 1 ? [...makers][0] ?? null : null;

  const base: OrderContext = { order, mode, makerUserId, origin: null, parcels: [], reason: null, canQuote: false };
  if (!order.store_id || artLines.length === 0) return { ...base, reason: "Nothing in this order ships." };
  if (mode === "arranged") return { ...base, reason: "Shipping is arranged with the artist." };
  if (!isEasyshipConfigured()) return { ...base, reason: "Shipping quotes are not set up." };
  if (makers.size !== 1 || !makerUserId) return { ...base, reason: "Pieces from more than one artist: shipping is arranged with each." };

  const origin = await getShipFrom(makerUserId);
  if (!origin) return { ...base, reason: "The artist has not set a ship-from address yet; shipping is arranged with them." };

  const parcels: OrderContext["parcels"] = [];
  for (const l of artLines) {
    const parcel = parcelFor(l);
    if (!parcel) return { ...base, origin, reason: "A piece has no packed size yet; shipping is arranged with the artist." };
    for (let i = 0; i < Math.max(1, num(l.quantity)); i++) {
      parcels.push({
        parcel,
        description: String(l.description ?? "Artwork").slice(0, 200),
        hsCode: parcel.hsCode || hsCodeFor(l.kind as string | null, l.medium as string | null),
        valueMinor: num(l.unit_price_minor),
      });
    }
  }
  return { ...base, origin, parcels, canQuote: true };
}

function toEasyshipAddress(a: Address & { email?: string | null; company?: string | null }, fallbackEmail: string): EasyshipAddress {
  return {
    contact_name: (a.recipientName || "Recipient").slice(0, 50),
    company_name: a.company ?? null,
    contact_phone: a.phone || "0000000000",
    contact_email: a.email || fallbackEmail,
    line_1: a.line1,
    line_2: a.line2 ?? null,
    city: a.city,
    state: a.region ?? null,
    postal_code: a.postalCode,
    country_alpha2: a.country.trim().toUpperCase(),
  };
}

function toEasyshipParcels(ctx: OrderContext, currency: string): EasyshipParcelInput[] {
  return ctx.parcels.map((p) => ({
    box: { length: p.parcel.lengthCm, width: p.parcel.widthCm, height: p.parcel.heightCm },
    items: [
      {
        quantity: 1,
        description: p.description,
        hs_code: p.hsCode,
        declared_currency: currency,
        declared_customs_value: p.valueMinor / 100,
        actual_weight: p.parcel.weightKg,
      },
    ],
  }));
}

function toOption(r: EasyshipRate): ShippingOption {
  return {
    id: r.courier_service.id,
    name: r.courier_service.name,
    courier: r.courier_service.umbrella_name,
    amountMinor: toMinor(r.total_charge),
    currency: r.currency,
    minDays: r.min_delivery_time ?? null,
    maxDays: r.max_delivery_time ?? null,
    importDutyMinor: toMinor(r.estimated_import_duty),
    importTaxMinor: toMinor(r.estimated_import_tax),
  };
}

// ---------------------------------------------------------------------------
// Buyer side
// ---------------------------------------------------------------------------

export interface OrderShippingState {
  /** True when the buyer must choose before paying. */
  required: boolean;
  mode: ShippingMode;
  canQuote: boolean;
  reason: string | null;
  chosen: OrderShipping | null;
  /** Ship-from country, for copy ("Ships from Canada"). */
  originCountry: string | null;
}

export async function getOrderShippingState(orderId: string): Promise<OrderShippingState | null> {
  const ctx = await loadContext(orderId);
  if (!ctx) return null;
  const chosen = ((ctx.order.metadata as Row | null)?.shipping as OrderShipping | undefined) ?? null;
  return {
    required: ctx.canQuote && !chosen,
    mode: ctx.mode,
    canQuote: ctx.canQuote,
    reason: ctx.reason,
    chosen,
    originCountry: ctx.origin?.country ?? null,
  };
}

/** Live quotes for an unpaid order to `address`. Nothing is bought or stored. */
export async function quoteOrderShipping(orderId: string, address: Address): Promise<Result<{ options: ShippingOption[] }>> {
  const ctx = await loadContext(orderId);
  if (!ctx) return { ok: false, error: "Order not found." };
  if (!UNPAID.includes(String(ctx.order.status))) return { ok: false, error: "This order is already paid." };
  if (!ctx.canQuote || !ctx.origin) return { ok: false, error: ctx.reason ?? "No quote for this order." };
  if (!address?.line1 || !address.city || !address.postalCode || !address.country) {
    return { ok: false, error: "Enter the street, city, postal code and country." };
  }
  const currency = String(ctx.order.currency).trim();
  try {
    const rates = await requestRates({
      origin: toEasyshipAddress(ctx.origin, ctx.origin.email),
      destination: toEasyshipAddress(address, String(ctx.order.customer_email || ctx.origin.email)),
      parcels: toEasyshipParcels(ctx, currency),
    });
    const options = rates
      .filter((r) => !EXCLUDED_SERVICE.test(r.courier_service.name))
      .map(toOption)
      .filter((o) => o.currency === currency)
      .sort((a, b) => a.amountMinor - b.amountMinor);
    if (options.length === 0) return { ok: false, error: "No courier ships this to that address. Choose “Arrange with the artist”." };
    return { ok: true, options };
  } catch (err) {
    if (err instanceof EasyshipError) {
      return { ok: false, error: err.status === 422 ? "No courier ships this to that address. Choose “Arrange with the artist”." : `Shipping quote failed: ${err.message}` };
    }
    throw err;
  }
}

/**
 * Fix the buyer's shipping on an unpaid order: a courier option (re-quoted
 * here, so the price cannot be forged from the client) or "arranged".
 */
export async function chooseOrderShipping(input: {
  orderId: string;
  address: Address;
  optionId: string | "arranged";
}): Promise<Result<{ shipping: OrderShipping }>> {
  const ctx = await loadContext(input.orderId);
  if (!ctx) return { ok: false, error: "Order not found." };
  if (!UNPAID.includes(String(ctx.order.status))) return { ok: false, error: "This order is already paid." };

  let option: ShippingOption | null = null;
  if (input.optionId !== "arranged") {
    const q = await quoteOrderShipping(input.orderId, input.address);
    if (!q.ok) return { ok: false, error: q.error };
    option = (q.options ?? []).find((o) => o.id === input.optionId) ?? null;
    if (!option) return { ok: false, error: "That shipping option is no longer offered. Get the rates again." };
  }

  const shipping: OrderShipping = {
    mode: ctx.mode,
    method: option ? "courier" : "arranged",
    option,
    address: input.address,
    chosenAt: new Date().toISOString(),
    env: easyshipEnv(),
  };
  const amount = option?.amountMinor ?? 0;
  const rows = (await db`
    UPDATE commerce_order
    SET shipping_minor = ${amount},
        total_minor = subtotal_minor + tax_minor + ${amount},
        shipping_address = ${jsonb(input.address)},
        metadata = COALESCE(metadata, '{}'::jsonb) || ${jsonb({ shipping })}
    WHERE id = ${input.orderId} AND status IN ('draft', 'pending_payment', 'awaiting_etransfer')
    RETURNING id
  `) as unknown as Row[];
  if (!rows[0]) return { ok: false, error: "This order can no longer be changed." };
  return { ok: true, shipping };
}

// ---------------------------------------------------------------------------
// Ledger (called from confirmOrderPaid, inside its transaction)
// ---------------------------------------------------------------------------

/**
 * Record the order's shipping money when it is paid (inside confirmOrderPaid's
 * transaction). The collective holds it:
 *   card / manual, quote mode    → maker accrual held `awaiting_tracking`
 *   card / manual, platform mode → platform accrual (it pays for the label)
 *   eTransfer, quote mode        → nothing: the buyer paid the maker directly
 *   eTransfer, platform mode     → maker owes it back (negative adjustment)
 *                                  and the platform accrues it
 * On a Stripe destination charge the shipping is part of the application
 * fee (checkout's resolveDestination), so it is on the platform account.
 */
export async function accrueOrderShipping(
  tx: typeof db,
  order: Row,
  makerUserId: string | null,
  confirmedBy: string | null,
  rail: string
): Promise<void> {
  const amount = num(order.shipping_minor);
  if (amount <= 0) return;
  const shipping = ((order.metadata as Row | null)?.shipping as OrderShipping | undefined) ?? null;
  const currency = String(order.currency).trim();
  const platform = shipping?.mode === "platform" || !makerUserId;
  const service = shipping?.option?.name ?? "courier";
  const base = { currency, orderId: order.id as string, orderLineId: null, createdBy: confirmedBy };

  if (rail === "etransfer") {
    if (!platform) return;
    if (makerUserId) {
      await writeEntry(
        { ...base, party: { kind: "user", userId: makerUserId }, entryType: "adjustment", amountMinor: -amount,
          note: `Shipping (${service}) received by eTransfer; the platform buys the label` },
        tx
      );
    }
    await writeEntry(
      { ...base, party: { kind: "platform" }, entryType: "accrual", amountMinor: amount,
        note: `Shipping paid by the buyer; pays for the platform label (${service})` },
      tx
    );
    return;
  }

  await writeEntry(
    platform
      ? { ...base, party: { kind: "platform" }, entryType: "accrual", amountMinor: amount,
          note: `Shipping paid by the buyer; pays for the platform label (${service})` }
      : { ...base, party: { kind: "user", userId: makerUserId! }, entryType: "accrual", amountMinor: amount,
          holdReason: "awaiting_tracking",
          note: `Shipping paid by the buyer (${service}); released when tracking is recorded` },
    tx
  );
}

// ---------------------------------------------------------------------------
// Seller / desk side
// ---------------------------------------------------------------------------

export interface ShipmentRow {
  id: string;
  orderId: string;
  mode: "quote" | "platform";
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  labelCostMinor: number | null;
  labelCurrency: string | null;
  status: string;
  createdAt: string;
}

function mapShipment(r: Row): ShipmentRow {
  return {
    id: r.id as string,
    orderId: r.order_id as string,
    mode: r.mode as "quote" | "platform",
    courierName: (r.courier_name as string | null) ?? null,
    trackingNumber: (r.tracking_number as string | null) ?? null,
    trackingUrl: (r.tracking_url as string | null) ?? null,
    labelUrl: (r.label_url as string | null) ?? null,
    labelCostMinor: r.label_cost_minor == null ? null : num(r.label_cost_minor),
    labelCurrency: (r.label_currency as string | null)?.trim() ?? null,
    status: r.status as string,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function getOrderShipment(orderId: string): Promise<ShipmentRow | null> {
  const [r] = (await db`
    SELECT * FROM shipment WHERE order_id = ${orderId} AND status NOT IN ('cancelled', 'failed')
    ORDER BY created_at DESC LIMIT 1
  `) as unknown as Row[];
  return r ? mapShipment(r) : null;
}

/** Release the maker's held shipping accrual for an order. Returns entries released. */
async function releaseShippingHold(tx: typeof db, orderId: string, by: string): Promise<number> {
  const held = (await tx`
    SELECT pl.* FROM payout_ledger pl
    WHERE pl.order_id = ${orderId} AND pl.hold_reason = 'awaiting_tracking' AND pl.entry_type = 'accrual'
      AND NOT EXISTS (SELECT 1 FROM payout_ledger r WHERE r.releases_entry_id = pl.id AND r.entry_type = 'release')
  `) as unknown as Row[];
  for (const e of held) {
    await writeEntry(
      {
        party: { kind: "user", userId: e.party_user_id as string },
        entryType: "release",
        amountMinor: 0,
        currency: e.currency as string,
        orderId,
        orderLineId: null,
        releasesEntryId: e.id as string,
        note: "Tracking recorded by the seller",
        createdBy: by,
      },
      tx
    );
  }
  return held.length;
}

/**
 * Quote mode: the seller shipped with their own label and records tracking.
 * Releases the held shipping money and marks the order fulfilled.
 * Access (store manager) is the caller's to check (`canActForOrder`).
 */
export async function recordSellerTracking(input: {
  orderId: string;
  actorUserId: string;
  courierName: string;
  trackingNumber: string;
  trackingUrl?: string | null;
}): Promise<Result> {
  const courier = input.courierName.trim();
  const number = input.trackingNumber.trim();
  if (!courier || !number) return { ok: false, error: "Enter the courier and the tracking number." };
  const url = input.trackingUrl?.trim() || null;
  if (url && !/^https:\/\//.test(url)) return { ok: false, error: "The tracking link must start with https://" };

  return db.begin(async (tx) => {
    const [o] = (await tx`SELECT status FROM commerce_order WHERE id = ${input.orderId} FOR UPDATE`) as unknown as Row[];
    if (!o) return { ok: false as const, error: "Order not found." };
    if (!["paid", "fulfilled"].includes(String(o.status))) return { ok: false as const, error: "Only a paid order ships." };
    const [live] = (await tx`
      SELECT id FROM shipment WHERE order_id = ${input.orderId} AND status NOT IN ('cancelled', 'failed') LIMIT 1
    `) as unknown as Row[];
    if (live) {
      await tx`
        UPDATE shipment SET courier_name = ${courier}, tracking_number = ${number}, tracking_url = ${url},
               status = 'shipped', updated_at = NOW()
        WHERE id = ${live.id as string}
      `;
    } else {
      await tx`
        INSERT INTO shipment (order_id, mode, provider, courier_name, tracking_number, tracking_url, status, created_by)
        VALUES (${input.orderId}, 'quote', 'seller', ${courier}, ${number}, ${url}, 'shipped', ${input.actorUserId})
      `;
    }
    await releaseShippingHold(tx as unknown as typeof db, input.orderId, input.actorUserId);
    await tx`
      UPDATE commerce_order
      SET status = 'fulfilled', fulfilled_at = COALESCE(fulfilled_at, NOW()),
          notes = COALESCE(notes || E'\n', '') || ${`[shipped] ${courier} ${number}`}
      WHERE id = ${input.orderId} AND status = 'paid'
    `;
    return { ok: true as const };
  });
}

/**
 * Platform mode: buy the label on the collective's Easyship account for the
 * courier service the buyer paid for. Spends money when EASYSHIP_ENV is
 * production. Access (store manager or network admin) is the caller's.
 */
export async function buyPlatformLabel(input: { orderId: string; actorUserId: string }): Promise<Result<{ shipment: ShipmentRow }>> {
  const ctx = await loadContext(input.orderId);
  if (!ctx) return { ok: false, error: "Order not found." };
  if (ctx.mode !== "platform") return { ok: false, error: "This store ships with its own labels." };
  if (String(ctx.order.status) !== "paid") return { ok: false, error: "Only a paid, unshipped order gets a label." };
  const shipping = ((ctx.order.metadata as Row | null)?.shipping as OrderShipping | undefined) ?? null;
  if (!shipping?.option) return { ok: false, error: "The buyer arranged shipping with the artist; there is no label to buy." };
  if (!ctx.canQuote || !ctx.origin) return { ok: false, error: ctx.reason ?? "Shipping details are incomplete." };
  if (await getOrderShipment(input.orderId)) return { ok: false, error: "This order already has a shipment." };

  // Claim the order's one live shipment row first, so two clicks cannot buy two labels.
  let claimId: string;
  try {
    const [claim] = (await db`
      INSERT INTO shipment (order_id, mode, provider, courier_service_id, courier_name, status, created_by)
      VALUES (${input.orderId}, 'platform', 'easyship', ${shipping.option.id}, ${shipping.option.name}, 'created', ${input.actorUserId})
      RETURNING id
    `) as unknown as Row[];
    claimId = claim!.id as string;
  } catch {
    return { ok: false, error: "A label is already being bought for this order." };
  }

  const currency = String(ctx.order.currency).trim();
  try {
    const s = await createShipmentWithLabel({
      origin: toEasyshipAddress(ctx.origin, ctx.origin.email),
      destination: toEasyshipAddress(shipping.address, String(ctx.order.customer_email || ctx.origin.email)),
      parcels: toEasyshipParcels(ctx, currency),
      courierServiceId: shipping.option.id,
      reference: String(ctx.order.number),
    });
    const label = (s.shipping_documents ?? []).find((d) => d.category === "label");
    const rate = (s.rates ?? []).find((r) => r.courier_service.id === shipping.option!.id) ?? (s.rates ?? [])[0];
    const tracking = (s.trackings ?? []).find((t) => t.tracking_number)?.tracking_number ?? null;
    const [row] = (await db`
      UPDATE shipment SET
        provider_shipment_id = ${s.easyship_shipment_id},
        tracking_number = ${tracking},
        tracking_url = ${s.tracking_page_url ?? null},
        label_url = ${label?.url ?? null},
        label_cost_minor = ${rate ? toMinor(rate.total_charge) : null},
        label_currency = ${rate?.currency ?? null},
        status = ${label?.url || s.label_state === "generated" ? "label_ready" : "created"},
        provider_payload = ${jsonb({ label_state: s.label_state, shipment_state: s.shipment_state, env: easyshipEnv() })},
        updated_at = NOW()
      WHERE id = ${claimId}
      RETURNING *
    `) as unknown as Row[];
    return { ok: true, shipment: mapShipment(row!) };
  } catch (err) {
    const message = err instanceof EasyshipError ? err.message : (err as Error).message;
    await db`
      UPDATE shipment SET status = 'failed', provider_payload = ${jsonb({ error: message })}, updated_at = NOW()
      WHERE id = ${claimId}
    `;
    return { ok: false, error: `Label purchase failed: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** Network admins only (caller checks `isNetworkAdmin`). */
export async function setStoreShippingMode(storeId: string, mode: ShippingMode): Promise<Result> {
  if (!SHIPPING_MODES.includes(mode)) return { ok: false, error: "Unknown shipping mode." };
  const rows = (await db`UPDATE store SET shipping_mode = ${mode} WHERE id = ${storeId} RETURNING id`) as unknown as Row[];
  return rows[0] ? { ok: true } : { ok: false, error: "Store not found." };
}

export async function getStoreShippingMode(storeId: string): Promise<ShippingMode> {
  const [r] = (await db`SELECT shipping_mode FROM store WHERE id = ${storeId} LIMIT 1`) as unknown as Row[];
  return ((r?.shipping_mode as ShippingMode | undefined) ?? "arranged");
}

/** Live shipments for a set of orders, keyed by order id. */
export async function listOrderShipments(orderIds: string[]): Promise<Record<string, ShipmentRow>> {
  if (orderIds.length === 0) return {};
  const rows = (await db`
    SELECT * FROM shipment
    WHERE order_id = ANY(${orderIds}::uuid[]) AND status NOT IN ('cancelled', 'failed')
    ORDER BY created_at
  `) as unknown as Row[];
  const out: Record<string, ShipmentRow> = {};
  for (const r of rows) out[r.order_id as string] = mapShipment(r);
  return out;
}

/** The buyer's choice as stored on an order's metadata, or null. */
export function orderShippingOf(metadata: Record<string, unknown> | null | undefined): OrderShipping | null {
  return ((metadata?.shipping as OrderShipping | undefined) ?? null);
}

export async function getArtworkParcel(artworkId: string): Promise<Parcel | null> {
  const [r] = (await db`SELECT parcel FROM artwork WHERE id = ${artworkId} LIMIT 1`) as unknown as Row[];
  return (r?.parcel as Parcel | null) ?? null;
}

/** Every store's shipping mode, keyed by store id (admin list). */
export async function listStoreShippingModes(): Promise<Record<string, ShippingMode>> {
  const rows = (await db`SELECT id, shipping_mode FROM store`) as unknown as Row[];
  return Object.fromEntries(rows.map((r) => [r.id as string, r.shipping_mode as ShippingMode]));
}
