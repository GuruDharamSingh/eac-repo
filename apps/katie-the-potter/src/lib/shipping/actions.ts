"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@elkdonis/db";
import { getOrderById } from "@elkdonis/commerce/queries";
import { canActForOrder, markOrderFulfilled } from "@elkdonis/commerce/server";
import type { Address, Order } from "@elkdonis/commerce/types";
import { guardStore } from "@/lib/manage";
import { siteOrigin } from "@/lib/origin";
import { loadOrderForViewer, UUID_RE } from "@/lib/shop";
import { shippingAccessFor } from "./access";
import { isEasyshipConfigured } from "./easyship";
import { packPiece } from "./parcel";
import type { ShippingOption } from "./rates";
import {
  accountOf,
  cleanPacking,
  cleanShipFrom,
  getInsurance,
  getPacking,
  getShipFrom,
  getShippingMode,
  insuranceView,
  labelBuyingEnabled,
  liveBlockers,
  saveInsurance,
  saveShipFrom,
  savePacking,
  setShippingMode,
  type ShippingMode,
} from "./settings";
import {
  chooseRate,
  correctShipTo,
  currentShipment,
  ensureLabel,
  ensureShipThisNotice,
  getShipment,
  isQuoteFlow,
  markQuoteTestPaid,
  markTestPaid,
  quote,
  ratesForOrder,
  recordKatieShipped,
  reopenChoice,
  startLabelPayment,
  startShippingPayment,
} from "./shipments";

// ============================================================================
// /manage/shipping (Katie) and /orders/<id>/shipping (the buyer). Every
// action re-checks who is asking: guardStore for the console (site editor AND
// on the store's team), the order page's own access rule plus the shipping
// mode for the buyer (lib/shipping/access.ts).
// ============================================================================

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };
const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });

// ── console ─────────────────────────────────────────────────────────────────

export async function saveShipFromAction(raw: Record<string, unknown>): Promise<ActionResult> {
  const g = await guardStore();
  if ("message" in g) return fail(g.message);
  const v = cleanShipFrom(raw ?? {});
  if (typeof v === "string") return fail(v);
  const before = await getShipFrom();
  // Keep the "checked" stamp only if the address itself did not change.
  await saveShipFrom({ ...v, checkedAt: before?.checkedAt ?? null, checkedHash: before?.checkedHash ?? null });
  revalidatePath("/manage/shipping");
  return ok("Ship-from address saved. Press Try it to check it with a quote.");
}

export async function clearShipFromAction(): Promise<ActionResult> {
  const g = await guardStore();
  if ("message" in g) return fail(g.message);
  const m = await getShippingMode();
  if (m === "live" || m === "quote") {
    return fail("Switch shipping to Off or Test before clearing the ship-from address.");
  }
  await saveShipFrom(null);
  revalidatePath("/manage/shipping");
  return ok("Ship-from address cleared.");
}

export async function savePackingAction(raw: { paddingCm?: unknown; boxKg?: unknown; extraPct?: unknown }): Promise<ActionResult> {
  const g = await guardStore();
  if ("message" in g) return fail(g.message);
  const num = (x: unknown) => (typeof x === "number" ? x : typeof x === "string" && x.trim() ? Number(x) : NaN);
  const p = { paddingCm: num(raw?.paddingCm), boxKg: num(raw?.boxKg), extraPct: num(raw?.extraPct) };
  if (![p.paddingCm, p.boxKg, p.extraPct].every((x) => Number.isFinite(x) && x >= 0)) return fail("Use numbers, 0 or more.");
  if (p.paddingCm > 20 || p.boxKg > 10 || p.extraPct > 100) return fail("Padding up to 20 cm, box up to 10 kg, extra up to 100 %.");
  await savePacking(cleanPacking(p));
  revalidatePath("/manage/shipping");
  return ok("Packing saved.");
}

export async function setShippingModeAction(mode: ShippingMode): Promise<ActionResult> {
  const g = await guardStore();
  if ("message" in g) return fail(g.message);
  if (!["off", "quote_test", "quote", "test", "live"].includes(mode)) return fail("Unknown choice.");
  // The parked label-buying modes need the developer flag (not enabled).
  if ((mode === "test" || mode === "live") && !labelBuyingEnabled()) return fail("Label buying is not enabled on this site.");
  const account = accountOf(mode);
  if (mode !== "off" && account === "test" && !isEasyshipConfigured("test")) return fail("The Easyship sandbox token is not set on this site.");
  if (mode !== "off" && account === "live") {
    if (g.store.ownerUserId !== g.viewer.userId) return fail("Only the shop's owner can switch shipping On.");
    if (!isEasyshipConfigured("live")) return fail("The Easyship production token is not set on this site.");
    const blockers = liveBlockers(await getShipFrom());
    if (blockers.length > 0) return fail(blockers.join(" "));
  }
  await setShippingMode(mode);
  revalidatePath("/manage/shipping");
  revalidatePath("/orders/[id]", "page");
  return ok(
    mode === "quote"
      ? "Shipping quotes are On: after paying, buyers choose a carrier and pay you for shipping; you buy the label."
      : mode === "quote_test"
        ? "Test mode: only editors see Choose shipping, with sandbox quotes and no payment."
        : mode === "live"
          ? "Label buying is Live (developer mode)."
          : mode === "test"
            ? "Label buying test (developer mode): sandbox labels, no payment."
            : "Shipping is Off: you arrange shipping by email, as before."
  );
}

/** Katie's insurance setting: she buys the label, so she decides. */
export async function saveInsuranceAction(raw: { insure?: unknown; buyerChooses?: unknown }): Promise<ActionResult> {
  const g = await guardStore();
  if ("message" in g) return fail(g.message);
  const insure = raw?.insure === true;
  const buyerChooses = insure && raw?.buyerChooses === true;
  await saveInsurance({ insure, buyerChooses });
  revalidatePath("/manage/shipping");
  return ok(
    !insure
      ? "Saved: you won't insure parcels, so quotes are shown without insurance."
      : buyerChooses
        ? "Saved: buyers can choose whether to insure (ticked to start)."
        : "Saved: every quote includes insurance for the piece's price."
  );
}

/**
 * Katie bought the label herself: record the carrier and tracking on the
 * shipment, mark the order shipped (when it is paid), and send the buyer the
 * tracking. Same access as every other money action: the store's owner or a
 * manager, on this store's order.
 */
export async function markShippedWithTrackingAction(shipmentId: string, input: { carrier?: unknown; trackingNumber?: unknown }): Promise<ActionResult> {
  const g = await guardStore();
  if ("message" in g) return fail(g.message);
  if (!UUID_RE.test(shipmentId ?? "")) return fail("Unknown shipment.");
  const row = await getShipment(shipmentId);
  if (!row) return fail("Unknown shipment.");
  const order = await getOrderById(row.orderId);
  if (!order || order.storeId !== g.store.id) return fail("That order isn't in this store.");
  if (!(await canActForOrder(g.viewer.userId, order.id, { minRole: "manager" }))) return fail("Only the store's owner or a manager can mark orders shipped.");
  const r = await recordKatieShipped(row, {
    carrier: typeof input?.carrier === "string" ? input.carrier : "",
    trackingNumber: typeof input?.trackingNumber === "string" ? input.trackingNumber : "",
    actorUserId: g.viewer.userId,
  });
  if (r.ok === false) return fail(r.message);
  let note = "";
  if (order.status === "paid") {
    try {
      await markOrderFulfilled({ orderId: order.id, actorUserId: g.viewer.userId, note: `Tracking ${r.row.courierName ?? ""} ${r.row.trackingNumber ?? ""}`.trim() });
    } catch (err) {
      console.error(`[katie-the-potter] markOrderFulfilled ${order.id}:`, err);
      note = " (The order itself couldn't be marked shipped; use Mark shipped.)";
    }
  }
  revalidatePath("/manage", "layout");
  revalidatePath(`/orders/${order.id}`);
  revalidatePath(`/orders/${order.id}/shipping`);
  return ok(`Marked shipped. ${row.mode === "test" ? "Test mode: the buyer's tracking email was logged, not sent." : "The buyer gets the tracking by email."}${note}`);
}

export interface TryInput {
  artworkId: string;
  /** Typed for the test when the piece has no weight (never saved). */
  weightKg: number | null;
  destination: Address;
}

export type TryResult =
  | { ok: true; featured: ShippingOption[]; rest: ShippingOption[]; parcel: string; account: "sandbox" | "production" }
  | { ok: false; message: string; details?: string[] };

/** "Try it": the rates one piece would get to one address. Quotes only. */
export async function tryRatesAction(input: TryInput): Promise<TryResult> {
  const g = await guardStore();
  if ("message" in g) return { ok: false, message: g.message };
  const origin = await getShipFrom();
  if (!origin) return { ok: false, message: "Save the ship-from address first." };
  if (!UUID_RE.test(input?.artworkId ?? "")) return { ok: false, message: "Choose a piece." };
  const [a] = await db<Array<Record<string, unknown>>>`
    SELECT a.id, a.title, a.medium, a.height_cm, a.width_cm, a.depth_cm, a.weight_kg,
      (SELECT min(price_minor) FROM artwork_variant v WHERE v.artwork_id = a.id) AS price_minor,
      (SELECT v.currency FROM artwork_variant v WHERE v.artwork_id = a.id ORDER BY v.price_minor LIMIT 1) AS currency
    FROM artwork a WHERE a.id = ${input.artworkId} AND a.store_id = ${g.store.id} LIMIT 1
  `;
  if (!a) return { ok: false, message: "That piece isn't in this store." };
  const typed = typeof input.weightKg === "number" && input.weightKg > 0 && input.weightKg <= 30 ? input.weightKg : null;
  const piece = {
    artworkId: String(a.id),
    title: String(a.title),
    medium: (a.medium as string | null) ?? null,
    heightCm: a.height_cm == null ? null : Number(a.height_cm),
    widthCm: a.width_cm == null ? null : Number(a.width_cm),
    depthCm: a.depth_cm == null ? null : Number(a.depth_cm),
    weightKg: a.weight_kg == null ? typed : Number(a.weight_kg),
    price: Math.max(1, (Number(a.price_minor) || 0) / 100),
    currency: String(a.currency ?? "CAD").trim() || "CAD",
  };
  const packed = packPiece(piece, await getPacking());
  if ("problem" in packed) return { ok: false, message: `${packed.problem}${piece.weightKg ? "" : " Type a weight for the test."}` };
  const d = input.destination ?? ({} as Address);
  if (!d.line1 || !d.city || !d.postalCode || !d.country) return { ok: false, message: "Fill in the test address." };
  // Off and the test modes ask the sandbox; On (quote) asks production for a
  // read-only quote (no shipment, no label, no money).
  const mode = accountOf(await getShippingMode());
  const q = await quote(mode, origin, d, { customerName: d.recipientName ?? "Test buyer", customerEmail: "", currency: piece.currency as Order["currency"] }, [packed]);
  revalidatePath("/manage/shipping");
  if (q.ok === false) {
    return {
      ok: false,
      message:
        q.kind === "address" && mode === "test" && d.country !== "CA"
          ? "No carrier answered in the sandbox. Easyship's sandbox has no Canada to US couriers; US quotes work in Live (checked with a real quote on 2026-11-07)."
          : q.message,
      details: q.details,
    };
  }
  return {
    ok: true,
    featured: q.featured,
    rest: q.rest,
    parcel: `${packed.lengthCm} × ${packed.widthCm} × ${packed.heightCm} cm, ${packed.weightKg} kg (HS ${packed.hsCode})`,
    account: mode === "live" ? "production" : "sandbox",
  };
}

// ── the buyer ───────────────────────────────────────────────────────────────

const back = (orderId: string, q: Record<string, string> = {}) => {
  const qs = new URLSearchParams(q).toString();
  return `/orders/${orderId}/shipping${qs ? `?${qs}` : ""}`;
};

async function gate(orderId: string) {
  const order = await loadOrderForViewer(orderId);
  if (!order) redirect("/");
  const access = await shippingAccessFor(order);
  if (!access) redirect(`/orders/${orderId}`);
  return { order, access };
}

/** "Pay for shipping" (live) or "Buy test label" (test, editors): the chosen option. */
export async function chooseShippingAction(orderId: string, form: FormData): Promise<void> {
  const { order, access } = await gate(orderId);
  const intent = String(form.get("intent") ?? "pay");
  const courierServiceId = String(form.get("option") ?? "");
  // Quote-only: insurance is Katie's setting (folded in, a buyer's checkbox, or none).
  const view = access.flow === "quote" ? insuranceView(await getInsurance()) : "choice";
  const ticked = form.get("insured") === "on" || form.get("insured") === "1";
  const insured = view === "included" ? true : view === "none" ? false : ticked;
  const accept = Number(form.get(`accept_${courierServiceId}_${insured ? "ins" : "no"}`));
  if (!courierServiceId || !Number.isFinite(accept)) redirect(back(orderId, { msg: "Choose one of the options." }));
  if (intent === "test" && access.mode !== "test") redirect(back(orderId, { msg: "Test labels are only for Test mode." }));
  if (intent === "pay" && access.mode !== "live") redirect(back(orderId, { msg: "In Test mode the payment step is skipped: use Buy test label." }));

  let row = await currentShipment(order.id, access.mode);
  if (!row || row.status !== "rated") {
    const r = await ratesForOrder(order, access.mode);
    if (r.ok === false) redirect(back(orderId, { msg: r.message }));
    row = r.row;
  }
  const chosen = await chooseRate({ row, order, courierServiceId, insured, acceptMinor: accept, flow: access.flow });
  if (chosen.ok === false) {
    redirect(back(orderId, chosen.changed ? { changed: `${chosen.changed.from}-${chosen.changed.to}-${chosen.changed.currency}`, option: courierServiceId } : { msg: chosen.message }));
  }

  if (access.flow === "quote") {
    if (access.mode === "test") {
      // Rehearsal: no Stripe and no ledger; Katie's "Ship this" email is logged.
      await markQuoteTestPaid(chosen.row);
      const after = await getShipment(chosen.row.id);
      if (after) await ensureShipThisNotice(after);
      revalidatePath(`/orders/${orderId}`);
      revalidatePath("/manage/orders");
      redirect(back(orderId, { test: "1" }));
    }
    let payUrl: string;
    try {
      payUrl = await startShippingPayment(chosen.row, order, await siteOrigin());
    } catch (err) {
      console.error(`[katie-the-potter] startShippingPayment ${orderId}:`, err);
      redirect(back(orderId, { msg: "Card payment couldn't be started. Nothing was charged. Please try again." }));
    }
    redirect(payUrl);
  }

  if (access.mode === "test") {
    await markTestPaid(chosen.row);
    await ensureLabel(chosen.row.id);
    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/manage/orders");
    redirect(back(orderId, { test: "1" }));
  }

  let url: string;
  try {
    url = await startLabelPayment(chosen.row, order, await siteOrigin());
  } catch (err) {
    console.error(`[katie-the-potter] startLabelPayment ${orderId}:`, err);
    redirect(back(orderId, { msg: "Card payment couldn't be started. Nothing was charged. Please try again." }));
  }
  redirect(url);
}

/** Back from a cancelled Stripe page: pay for the same choice. */
export async function continueShippingPaymentAction(orderId: string): Promise<void> {
  const { order, access } = await gate(orderId);
  if (access.mode !== "live") redirect(back(orderId));
  const row = await currentShipment(order.id, "live");
  if (!row || row.status !== "awaiting_payment") redirect(back(orderId));
  let url: string;
  try {
    url = isQuoteFlow(row) ? await startShippingPayment(row, order, await siteOrigin()) : await startLabelPayment(row, order, await siteOrigin());
  } catch (err) {
    console.error(`[katie-the-potter] continue payment ${orderId}:`, err);
    redirect(back(orderId, { msg: "Card payment couldn't be started. Nothing was charged." }));
  }
  redirect(url);
}

export async function rechooseShippingAction(orderId: string): Promise<void> {
  const { order, access } = await gate(orderId);
  const row = await currentShipment(order.id, access.mode);
  if (row) {
    const r = await reopenChoice(row);
    if (r.status !== "rated") redirect(back(orderId));
  }
  redirect(back(orderId));
}

export async function refreshShippingRatesAction(orderId: string): Promise<void> {
  const { order, access } = await gate(orderId);
  await ratesForOrder(order, access.mode, { force: true });
  redirect(back(orderId));
}

/** The buyer fixes their address before anything is bought. */
export async function correctAddressAction(orderId: string, form: FormData): Promise<void> {
  const { order, access } = await gate(orderId);
  const cur = await currentShipment(order.id, access.mode);
  if (cur && cur.status !== "rated" && cur.status !== "cancelled" && cur.status !== "refunded" && cur.status !== "failed") {
    redirect(back(orderId, { msg: "The label is already on its way; write to Katie to change the address." }));
  }
  const t = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max);
  const a: Address = {
    recipientName: t("recipientName", 200) || order.shippingAddress?.recipientName || order.customerName || null,
    line1: t("line1", 200),
    line2: t("line2", 200) || null,
    city: t("city", 100),
    region: t("region", 60).toUpperCase() || null,
    postalCode: t("postalCode", 20).toUpperCase(),
    country: (t("country", 2) || order.shippingAddress?.country || "CA").toUpperCase(),
    phone: t("phone", 40) || order.shippingAddress?.phone || null,
  };
  if (!a.line1 || !a.city || !a.postalCode) redirect(back(orderId, { msg: "Please fill in the street, city and postal code.", edit: "1" }));
  if (!["CA", "US"].includes(a.country)) redirect(back(orderId, { msg: "Katie ships to Canada and the US.", edit: "1" }));
  await correctShipTo(order, access.mode, a);
  revalidatePath(`/orders/${orderId}`);
  redirect(back(orderId, { fixed: "1" }));
}

