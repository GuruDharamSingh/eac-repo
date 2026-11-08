"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { getOrderById } from "@elkdonis/commerce/queries";
import {
  archiveArtwork,
  canActForOrder,
  cancelOrder,
  confirmOrderPaid,
  createArtwork,
  markOrderFulfilled,
  publishArtwork,
  refundOrder,
  setArtworkMedia,
  updateArtwork,
} from "@elkdonis/commerce/server";
import type { ArtworkKind, ArtworkMediaInput, Currency } from "@elkdonis/commerce/types";
import { guardStore } from "@/lib/manage";
import { UUID_RE } from "@/lib/shop";
import { getShippingMode } from "@/lib/shipping/settings";

/** While shipping is Test or Live, a piece needs a size and a weight to go on sale (the parcel is built from them). */
const NEEDS_SIZE_AND_WEIGHT =
  "Shipping is switched on, so a piece needs its height, width and weight before it goes on sale (the carriers price the box from them). Add them under Size and weight, then put it on sale again.";
async function shippingNeedsSize(): Promise<boolean> {
  return (await getShippingMode().catch(() => "off")) !== "off";
}

// ============================================================================
// The seller console's server actions, modelled on art-auction's
// studio/actions.ts but for ONE store (the site owner's) and returning
// { ok, message } instead of throwing: a thrown Error reaches the browser with
// its message stripped in production. Every action re-checks the viewer's
// site role AND store role (lib/manage.ts guardStore) because a client
// component is not an authorisation boundary. Maker-credit, beneficiary,
// provenance and estimates are deliberately absent.
// ============================================================================

export type ActionResult = { ok: true; message: string; id?: string } | { ok: false; message: string };

const fail = (message: string): ActionResult => ({ ok: false, message });
const done = (message: string, id?: string): ActionResult => ({ ok: true, message, ...(id ? { id } : {}) });

function friendly(err: unknown, fallback: string): ActionResult {
  console.error("[katie-the-potter] manage action:", err);
  const m = err instanceof Error ? err.message : "";
  // commerce's own refusals are written for people ("Add at least one image before publishing.").
  return fail(m && m.length < 200 && !/^\s*(select|insert|update|delete)\b/i.test(m) ? m : fallback);
}

/** After any change: the public pages that show pieces, and the console's own. */
function refreshPublic(artworkId?: string) {
  revalidatePath("/");
  revalidatePath("/pieces/[slug]", "page");
  revalidatePath("/manage", "layout");
  if (artworkId) revalidatePath(`/manage/pieces/${artworkId}`);
}

async function pieceInStore(artworkId: string, storeId: string) {
  if (!UUID_RE.test(artworkId)) return null;
  const [row] = await db<Array<{ id: string; status: string; metadata: Record<string, unknown> }>>`
    SELECT id, status, metadata FROM artwork WHERE id = ${artworkId} AND store_id = ${storeId} LIMIT 1
  `;
  return row ?? null;
}

// ── pieces ───────────────────────────────────────────────────────────────────

export interface PieceInput {
  title: string;
  descriptionHtml: string;
  kind: ArtworkKind;
  yearCreated: number | null;
  medium: string;
  style: string;
  heightCm: number | null;
  widthCm: number | null;
  depthCm: number | null;
  /** The piece itself, unpacked (2026-11-07, for shipping quotes). */
  weightKg?: number | null;
  /** Major units (dollars); 0 or empty = price on request. */
  price: number | null;
  currency: Currency;
  inventoryQty: number;
  images: Array<{ url: string; alt: string }>;
  /** Save and put it on sale in one go (needs a picture). */
  publish: boolean;
}

const KINDS: ArtworkKind[] = ["original", "limited_edition", "open_edition"];
const CURRENCIES: Currency[] = ["CAD", "USD"];

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;

function cleanImages(raw: PieceInput["images"]): ArtworkMediaInput[] | string {
  if (!Array.isArray(raw)) return "Pictures are missing.";
  if (raw.length > 12) return "At most 12 pictures.";
  const out: ArtworkMediaInput[] = [];
  for (const [i, img] of raw.entries()) {
    const url = text(img?.url, 600);
    // Only pictures that went through this site's own upload route / proxy.
    if (!url.startsWith("/api/media/EAC_Network/") || url.includes("..")) return "One of the pictures is not from this site's library. Upload it again.";
    out.push({ url, alt: text(img?.alt, 200) || null, role: i === 0 ? "hero" : "detail" });
  }
  return out;
}

/** Create (artworkId null) or update a piece; optionally publish it. */
export async function savePieceAction(artworkId: string | null, input: PieceInput): Promise<ActionResult> {
  const g = await guardStore();
  if ("message" in g) return fail(g.message);

  const title = text(input?.title, 200);
  if (!title) return fail("A title is required.");
  if (!KINDS.includes(input.kind)) return fail("Choose what kind of piece this is.");
  const currency = CURRENCIES.includes(input.currency) ? input.currency : "CAD";
  const price = input.price == null ? 0 : num(input.price, 0, 1_000_000);
  if (price === null) return fail("That price doesn't look right.");
  const qty = num(input.inventoryQty, 1, 999);
  if (qty === null || !Number.isInteger(qty)) return fail("Quantity must be a whole number, 1 or more.");
  const images = cleanImages(input.images);
  if (typeof images === "string") return fail(images);
  if (input.publish && images.length === 0) return fail("Add at least one picture before putting a piece on sale.");
  if (input.publish && (await shippingNeedsSize())) {
    const h = num(input.heightCm, 0, 10_000);
    const w = num(input.widthCm, 0, 10_000);
    const kg = num(input.weightKg, 0, 500);
    if (!h || !w || !kg) return fail(NEEDS_SIZE_AND_WEIGHT);
  }

  const fields = {
    descriptionHtml: input.descriptionHtml ? input.descriptionHtml.slice(0, 20_000) : null,
    kind: input.kind,
    yearCreated: num(input.yearCreated, 1000, 2200),
    medium: text(input.medium, 200) || null,
    style: text(input.style, 200) || null,
    heightCm: num(input.heightCm, 0, 10_000),
    widthCm: num(input.widthCm, 0, 10_000),
    depthCm: num(input.depthCm, 0, 10_000),
    weightKg: num(input.weightKg, 0, 500),
    priceMinor: Math.round(price * 100),
    currency,
    inventoryQty: qty,
  };

  try {
    let id = artworkId;
    let wasOnSale = false;
    if (id) {
      const piece = await pieceInStore(id, g.store.id);
      if (!piece) return fail("That piece isn't in this store.");
      if (piece.status === "reserved" || piece.status === "sold") {
        return fail(`This piece is ${piece.status}, so changes are paused. It has an order behind it; handle that under Orders.`);
      }
      wasOnSale = piece.status === "available";
      await updateArtwork(id, g.viewer.userId, { title, ...fields });
      await setArtworkMedia(id, g.viewer.userId, images);
    } else {
      ({ id } = await createArtwork({ storeId: g.store.id, actorUserId: g.viewer.userId, artistUserId: g.store.ownerUserId ?? g.viewer.userId, title, ...fields, images }));
    }
    if (input.publish && id) await publishArtwork(id, g.viewer.userId);
    refreshPublic(id ?? undefined);
    revalidatePath("/manage/pieces");
    // 2026-11-06: an edit to a piece already on sale stays on sale; it used to say "Saved as a draft."
    return done(input.publish ? "Saved and on sale." : wasOnSale ? "Saved. It is still on sale." : "Saved as a draft.", id ?? undefined);
  } catch (err) {
    return friendly(err, "We couldn't save that piece. Please try again.");
  }
}

export type ShownAs = "sale" | "portfolio" | "hidden";

/**
 * How a piece is shown, as one switch over the marketplace's own listing
 * status (the convention lib/artworks.ts reads and danamccool's console used):
 *   sale       status available (listed, with an Add to cart)
 *   portfolio  status archived + metadata.site = "portfolio" (a picture only)
 *   hidden     status archived, no flag
 * Sold and reserved pieces have an order behind them and are left alone.
 */
export async function setShownAsAction(artworkId: string, mode: ShownAs): Promise<ActionResult> {
  const g = await guardStore();
  if ("message" in g) return fail(g.message);
  try {
    const piece = await pieceInStore(artworkId, g.store.id);
    if (!piece) return fail("That piece isn't in this store.");
    if (!["draft", "available", "archived"].includes(piece.status)) {
      return fail(`This piece is ${piece.status}; it has an order behind it, so it can't be switched here.`);
    }
    if (mode === "sale") {
      if (piece.status !== "available" && (await shippingNeedsSize())) {
        const [dims] = await db<Array<{ h: string | null; w: string | null; kg: string | null }>>`
          SELECT height_cm AS h, width_cm AS w, weight_kg AS kg FROM artwork WHERE id = ${artworkId} AND store_id = ${g.store.id}
        `;
        if (!Number(dims?.h) || !Number(dims?.w) || !Number(dims?.kg)) return fail(NEEDS_SIZE_AND_WEIGHT);
      }
      await publishArtwork(artworkId, g.viewer.userId);
      await db`UPDATE artwork SET metadata = metadata - 'site' WHERE id = ${artworkId} AND store_id = ${g.store.id}`;
    } else if (mode === "portfolio") {
      await archiveArtwork(artworkId, g.viewer.userId);
      await db`UPDATE artwork SET metadata = metadata || '{"site": "portfolio"}'::jsonb WHERE id = ${artworkId} AND store_id = ${g.store.id}`;
    } else if (mode === "hidden") {
      await archiveArtwork(artworkId, g.viewer.userId);
      await db`UPDATE artwork SET metadata = metadata - 'site' WHERE id = ${artworkId} AND store_id = ${g.store.id}`;
    } else {
      return fail("Unknown choice.");
    }
    refreshPublic(artworkId);
    revalidatePath("/manage/pieces");
    return done(mode === "sale" ? "On sale." : mode === "portfolio" ? "Shown as a picture only." : "Hidden from the site.");
  } catch (err) {
    return friendly(err, "We couldn't change that. Please try again.");
  }
}

/**
 * Retire the sample pieces in one go: every draft or available piece in this
 * store with metadata.sample = 'true' is archived. Pieces with an order
 * behind them (reserved, sold) are left alone. Owner only: it changes what
 * the public sees in bulk.
 */
export async function retireSamplesAction(): Promise<ActionResult> {
  const g = await guardStore();
  if ("message" in g) return fail(g.message);
  if (g.store.ownerUserId !== g.viewer.userId) return fail("Only the store's owner can retire the samples.");
  try {
    const rows = await db<Array<{ id: string }>>`
      UPDATE artwork SET status = 'archived'
      WHERE store_id = ${g.store.id} AND metadata->>'sample' = 'true' AND status IN ('draft', 'available')
      RETURNING id
    `;
    refreshPublic();
    revalidatePath("/manage/pieces");
    return done(rows.length === 0 ? "There were no sample pieces to retire." : `Retired ${rows.length} sample ${rows.length === 1 ? "piece" : "pieces"}.`);
  } catch (err) {
    return friendly(err, "We couldn't retire the samples. Please try again.");
  }
}

// ── orders ───────────────────────────────────────────────────────────────────

/**
 * Money actions need manager or above (staff can list and edit work only) AND
 * the order must be this store's: an editor who also runs another store may not
 * use this console on that store's orders.
 */
async function orderAccess(orderId: string): Promise<{ userId: string; payment: string; status: string } | string> {
  const g = await guardStore();
  if ("message" in g) return g.message;
  if (!UUID_RE.test(orderId)) return "Unknown order.";
  const order = await getOrderById(orderId);
  if (!order || order.storeId !== g.store.id) return "That order isn't in this store.";
  if (!(await canActForOrder(g.viewer.userId, orderId, { minRole: "manager" }))) {
    return "Only the store's owner or a manager can settle orders.";
  }
  return { userId: g.viewer.userId, payment: order.paymentMethod, status: order.status };
}

function afterOrder(orderId: string) {
  revalidatePath("/manage", "layout");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/");
}

/** The seller confirms an Interac eTransfer arrived. */
export async function confirmEtransferAction(orderId: string, reference?: string): Promise<ActionResult> {
  const a = await orderAccess(orderId);
  if (typeof a === "string") return fail(a);
  if (a.payment !== "etransfer") return fail("Only eTransfer orders are confirmed by hand; card payments confirm themselves.");
  try {
    await confirmOrderPaid({ orderId, confirmedByUserId: a.userId, method: "etransfer", paymentReference: text(reference, 100) || undefined });
    afterOrder(orderId);
    return done("Marked as paid. The buyer's order page now shows it.");
  } catch (err) {
    return friendly(err, "We couldn't confirm that order. It may already be paid.");
  }
}

export async function shipOrderAction(orderId: string, note?: string): Promise<ActionResult> {
  const a = await orderAccess(orderId);
  if (typeof a === "string") return fail(a);
  try {
    await markOrderFulfilled({ orderId, actorUserId: a.userId, note: text(note, 300) || undefined });
    afterOrder(orderId);
    return done("Marked as shipped.");
  } catch (err) {
    return friendly(err, "We couldn't mark that shipped. Only a paid order can be.");
  }
}

export async function cancelOrderAction(orderId: string, reason?: string): Promise<ActionResult> {
  const a = await orderAccess(orderId);
  if (typeof a === "string") return fail(a);
  try {
    await cancelOrder({ orderId, actorUserId: a.userId, reason: text(reason, 300) || "by seller" });
    afterOrder(orderId);
    return done("Order cancelled. The piece is back on sale.");
  } catch (err) {
    return friendly(err, "We couldn't cancel that order. Only an unpaid order can be cancelled.");
  }
}

/** The seller records that they refunded an eTransfer sale. Card refunds are made from the Stripe dashboard, by an admin. */
export async function refundOrderAction(orderId: string, reason?: string): Promise<ActionResult> {
  const a = await orderAccess(orderId);
  if (typeof a === "string") return fail(a);
  if (a.payment === "stripe") return fail("Card orders are refunded from the Stripe dashboard. Ask an admin of the collective.");
  try {
    await refundOrder({ orderId, actorUserId: a.userId, reason: text(reason, 300) || "by seller" });
    afterOrder(orderId);
    return done("Recorded as refunded.");
  } catch (err) {
    return friendly(err, "We couldn't record that refund.");
  }
}
