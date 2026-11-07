"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@elkdonis/db";
import { clearCartToken, readCartToken, withCartToken } from "@elkdonis/checkout/server";
import { CardCheckoutRefused, isCardPaymentAvailable, startStripeCheckout } from "@elkdonis/checkout/stripe";
import type { CheckoutFormValues } from "@elkdonis/checkout";
import {
  addToCart,
  createOrder,
  createOrderFromCart,
  loadVariantItem,
  removeCartLine,
  switchOrderToEtransfer,
} from "@elkdonis/commerce/server";
import { getCartByToken } from "@elkdonis/commerce/queries";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { getSiteStoreId } from "@/lib/artworks";
import { siteOrigin } from "@/lib/origin";
import { anySampleArtwork, cartHasSamplePiece, orderHasSamplePiece, SAMPLE_CARD_REFUSAL } from "@/lib/sample-guard";
import { cartOwnsLine, getCartCount, loadOrderForViewer, UUID_RE } from "@/lib/shop";

// ============================================================================
// The buyer journey's server actions: add to cart, remove, place order, and
// pay an order by card or eTransfer. They wrap the same shared functions the
// marketplace uses (@elkdonis/commerce/server, @elkdonis/checkout/*), with
// three differences on purpose:
//
//   - every URL handed to Stripe is THIS site's origin (lib/origin.ts);
//   - the "where does the site's share go" choice is skipped (support: null);
//   - a thrown Error from a server action reaches the browser as a generic
//     message in production, so anything a buyer needs to read is RETURNED
//     as { ok: false, message } instead.
// ============================================================================

export type AddToCartResult =
  | { ok: true; count: number; already: boolean }
  | { ok: false; message: string };

/**
 * The variant a buyer may buy for this artwork, read here and never taken
 * from the browser: only Katie's own store's pieces, only a priced variant
 * (0 = price on request), only while the piece is available.
 */
async function sellableVariant(artworkId: string): Promise<{ ok: true; variantId: string } | { ok: false; message: string }> {
  if (typeof artworkId !== "string" || !UUID_RE.test(artworkId)) {
    return { ok: false, message: "This piece can't be bought from here." };
  }
  const storeId = await getSiteStoreId();
  if (!storeId) return { ok: false, message: "The shop isn't open yet." };
  const [v] = await db<Array<{ variant_id: string; status: string }>>`
    SELECT av.id AS variant_id, a.status
    FROM artwork a JOIN artwork_variant av ON av.artwork_id = a.id
    WHERE a.id = ${artworkId} AND a.store_id = ${storeId} AND av.price_minor > 0
    ORDER BY av.position, av.price_minor
    LIMIT 1
  `;
  if (!v) return { ok: false, message: "This piece is priced on request. Please enquire about it instead." };
  if (v.status === "sold") return { ok: false, message: "This piece has sold." };
  if (v.status === "reserved") return { ok: false, message: "Someone else has just reserved this piece. Check back soon." };
  if (v.status !== "available") return { ok: false, message: "This piece isn't for sale right now." };
  return { ok: true, variantId: v.variant_id };
}

/** Add a piece (by artwork id) to this visitor's cart. One-of-a-kind: adding twice is a no-op. */
export async function addPieceToCart(artworkId: string): Promise<AddToCartResult> {
  try {
    const sv = await sellableVariant(artworkId);
    if (sv.ok === false) return { ok: false, message: sv.message };
    const v = { variant_id: sv.variantId };

    const viewer = await getViewer().catch(() => null);
    const already = await withCartToken(
      async (token) => {
        const [dup] = await db`
          SELECT 1 FROM cart_line cl JOIN cart c ON c.id = cl.cart_id
          WHERE c.token = ${token} AND cl.artwork_variant_id = ${v.variant_id} LIMIT 1
        `;
        if (dup) return true;
        await addToCart({ cartToken: token, artworkVariantId: v.variant_id, quantity: 1 });
        return false;
      },
      { userId: viewer?.userId ?? null }
    );
    revalidatePath("/cart");
    revalidatePath("/", "layout");
    return { ok: true, count: await getCartCount(), already };
  } catch (err) {
    console.error("[katie-the-potter] addPieceToCart:", err);
    const m = err instanceof Error ? err.message : "";
    // commerce's own messages for a state change under the buyer are safe to show.
    if (/reserved|has sold|not listed|no longer available|not currently selling|basket is with another/i.test(m)) {
      return { ok: false, message: m };
    }
    return { ok: false, message: "We couldn't add that to your cart. Please try again." };
  }
}

/** Remove a line from the cart. Form action: bind the line id. */
export async function removeFromCart(lineId: string): Promise<void> {
  const token = await readCartToken();
  if (token && (await cartOwnsLine(token, lineId))) {
    await removeCartLine({ lineId });
  }
  revalidatePath("/cart");
  revalidatePath("/", "layout");
}

const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

export type PlaceOrderResult = { ok: false; message: string } | undefined;

/**
 * Convert the cart into an order on the rail the buyer chose, then send them
 * to Stripe (card) or to the order page (eTransfer). Returns a message only
 * when it could not; success is a redirect.
 */
export async function placeOrder(values: CheckoutFormValues): Promise<PlaceOrderResult> {
  const token = await readCartToken();
  const cart = token ? await getCartByToken(token) : null;
  if (!token || !cart || (cart.lines?.length ?? 0) === 0) return { ok: false, message: "Your cart is empty." };

  // createOrder does not re-check artwork.status, so a piece someone else
  // reserved or bought since it went into this cart is caught here.
  for (const line of cart.lines ?? []) {
    if (line.artwork?.status !== "available") {
      return {
        ok: false,
        message: `“${line.artwork?.title ?? "A piece"}” is no longer available. Someone else may have reserved it. Remove it from your cart to continue.`,
      };
    }
  }

  const customerEmail = clean(values.customerEmail, 200);
  const customerName = clean(values.customerName, 200);
  const a = values.shippingAddress ?? ({} as CheckoutFormValues["shippingAddress"]);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) return { ok: false, message: "Please enter a valid email address." };
  if (!customerName) return { ok: false, message: "Please enter your name." };
  if (!clean(a.line1, 200) || !clean(a.city, 100) || !clean(a.postalCode, 20)) {
    return { ok: false, message: "Please complete the shipping address." };
  }

  const wantsCard = values.paymentMethod === "stripe";
  if (wantsCard) {
    if (!isCardPaymentAvailable()) return { ok: false, message: "Card payments are not available right now. Please pay by eTransfer." };
    if (await cartHasSamplePiece(token)) return { ok: false, message: SAMPLE_CARD_REFUSAL };
  }
  const rail = wantsCard ? "stripe" : "etransfer";

  const viewer = await getViewer().catch(() => null);
  const origin = await siteOrigin();
  let orderId: string;
  try {
    const order = await createOrderFromCart({
      cartToken: token,
      paymentMethod: rail,
      customerEmail,
      customerName,
      customerId: viewer?.userId ?? null,
      shippingAddress: {
        recipientName: clean(a.recipientName, 200) || null,
        line1: clean(a.line1, 200),
        line2: clean(a.line2, 200) || null,
        city: clean(a.city, 100),
        region: clean(a.region, 100) || null,
        postalCode: clean(a.postalCode, 20),
        country: clean(a.country, 2).toUpperCase() || "CA",
        phone: clean(a.phone, 40) || null,
      },
      notes: clean(values.notes, 1000) || null,
      etransferDueHours: siteConfig.etransferDueHours,
      payUrl: `${origin}/orders/`,
      // The marketplace's "where should the site's share go" choice is skipped:
      // null takes the default (the marketplace keeps it).
      support: null,
    });
    orderId = order.id;
  } catch (err) {
    console.error("[katie-the-potter] placeOrder:", err);
    return { ok: false, message: "We couldn't place your order. Please try again, or write to us." };
  }

  await clearCartToken();
  revalidatePath("/", "layout");
  // redirect() throws, so both stay outside any try.
  if (rail === "stripe") redirect(await cardCheckoutUrl(orderId, origin));
  redirect(`/orders/${orderId}`);
}

/**
 * Where to send a buyer who chose card: Stripe's hosted page, or, when Stripe
 * will not open a session for this order, back to the order page, which
 * already offers eTransfer and a retry. successUrl/cancelUrl/imageBase are
 * THIS site's. The success URL goes through our own return hop
 * (/api/checkout/return), which reconciles the order and lands on
 * /orders/<id>?paid=1.
 */
async function cardCheckoutUrl(orderId: string, origin: string, collect?: StripeCollect | null): Promise<string> {
  try {
    const { url } = await startStripeCheckout({
      orderId,
      successUrl: `${origin}/api/checkout/return?order=${orderId}`,
      cancelUrl: `${origin}/orders/${orderId}?cancelled=1`,
      imageBase: origin,
      ...(collect ? { collect } : {}),
    });
    return url;
  } catch (err) {
    if (err instanceof CardCheckoutRefused) return `/orders/${orderId}?card=${err.reason}`;
    throw err;
  }
}

type StripeCollect = NonNullable<Parameters<typeof startStripeCheckout>[0]["collect"]>;

/**
 * What Stripe's page asks for when we have not asked ourselves ("Buy now",
 * "Pay now" on the cart): the email, unless the buyer is signed in, and a
 * shipping address in one of the countries Katie ships to. Stripe's answers
 * are written onto the order on the return hop and by the webhook.
 */
function stripeCollects(knownEmail: string | null | undefined): StripeCollect {
  return {
    email: !knownEmail?.trim(),
    shippingAddress: { allowedCountries: [...siteConfig.shipToCountries] },
  };
}

/**
 * "Buy now" on a piece's page: an order for just this piece, straight to
 * Stripe's page (card, and Apple Pay / Google Pay where the device has them),
 * which asks for the email and shipping address. The visitor's cart is left
 * as it is, except a line for this same piece, which could only say "no
 * longer available" afterwards.
 *
 * The order is created with no email when the buyer is not signed in: a card
 * order sends nothing at creation (commerce announces card orders on
 * payment), and the email Stripe collects is written onto the order before
 * it is confirmed (recordCheckoutCustomer). Returns a message when it could
 * not start; success is a redirect.
 */
export async function buyPieceNow(artworkId: string): Promise<PlaceOrderResult> {
  let orderId: string;
  let origin: string;
  let email = "";
  try {
    const sv = await sellableVariant(artworkId);
    if (sv.ok === false) return { ok: false, message: sv.message };
    if (!isCardPaymentAvailable()) {
      return { ok: false, message: "Card payments are not available right now. Add it to your cart to pay by Interac eTransfer." };
    }
    if (await anySampleArtwork([artworkId])) return { ok: false, message: SAMPLE_CARD_REFUSAL };

    const viewer = await getViewer().catch(() => null);
    email = viewer?.email?.trim() ?? "";
    origin = await siteOrigin();
    const item = await loadVariantItem(sv.variantId);
    const order = await createOrder({
      items: [item],
      paymentMethod: "stripe",
      customerEmail: email,
      customerName: null,
      customerId: viewer?.userId ?? null,
      payUrl: `${origin}/orders/`,
      support: null,
      metadata: { source: "buy_now" },
    });
    orderId = order.id;
    await dropVariantFromCart(sv.variantId);
  } catch (err) {
    console.error("[katie-the-potter] buyPieceNow:", err);
    return { ok: false, message: "We couldn't start the payment. Please try again, or add it to your cart." };
  }

  revalidatePath("/", "layout");
  redirect(await cardCheckoutUrl(orderId, origin, stripeCollects(email)));
}

/** Remove this visitor's cart line(s) for a variant. Never throws. */
async function dropVariantFromCart(variantId: string): Promise<void> {
  try {
    const token = await readCartToken();
    if (!token) return;
    const rows = await db<Array<{ id: string }>>`
      SELECT cl.id FROM cart_line cl JOIN cart c ON c.id = cl.cart_id
      WHERE c.token = ${token} AND cl.artwork_variant_id = ${variantId}
    `;
    for (const r of rows) await removeCartLine({ lineId: r.id });
  } catch (err) {
    console.error("[katie-the-potter] dropVariantFromCart:", err);
  }
}

/**
 * "Pay now with card / Google Pay" on the cart: the whole cart as a card
 * order, straight to Stripe's page, which collects the email and shipping
 * address (our checkout form is skipped). Form action: failures come back to
 * /cart?express=<why>, which says what to do.
 */
export async function expressCheckoutCart(): Promise<void> {
  const token = await readCartToken();
  const cart = token ? await getCartByToken(token) : null;
  if (!token || !cart || (cart.lines?.length ?? 0) === 0) redirect("/cart");
  if ((cart.lines ?? []).some((l) => l.artwork?.status !== "available")) redirect("/cart");
  if (!isCardPaymentAvailable()) redirect("/cart?express=unavailable");
  if (await cartHasSamplePiece(token)) redirect("/cart?express=sample");

  const viewer = await getViewer().catch(() => null);
  const email = viewer?.email?.trim() ?? "";
  const origin = await siteOrigin();
  let orderId: string | null = null;
  try {
    const order = await createOrderFromCart({
      cartToken: token,
      paymentMethod: "stripe",
      customerEmail: email,
      customerName: null,
      customerId: viewer?.userId ?? null,
      payUrl: `${origin}/orders/`,
      support: null,
    });
    orderId = order.id;
  } catch (err) {
    console.error("[katie-the-potter] expressCheckoutCart:", err);
  }
  if (!orderId) redirect("/cart?express=failed");

  await clearCartToken();
  revalidatePath("/", "layout");
  redirect(await cardCheckoutUrl(orderId, origin, stripeCollects(email)));
}

/** From the order page: pay (or retry paying) an unpaid order by card. */
export async function payOrderByCard(orderId: string): Promise<void> {
  const order = await loadOrderForViewer(orderId);
  if (!order) redirect("/");
  if (!isCardPaymentAvailable()) redirect(`/orders/${orderId}?card=unavailable`);
  if (await orderHasSamplePiece(orderId)) redirect(`/orders/${orderId}?card=sample`);
  // A Buy-now order retried after backing out of Stripe still has no email or
  // address of ours: Stripe's page asks again. An order placed through our
  // form has both and gets the session it always got.
  const collect = !order.customerEmail?.trim() || !order.shippingAddress ? stripeCollects(order.customerEmail) : null;
  redirect(await cardCheckoutUrl(orderId, await siteOrigin(), collect));
}

/** From the order page: switch an unpaid order to eTransfer instructions. */
export async function payOrderByEtransfer(orderId: string): Promise<void> {
  const order = await loadOrderForViewer(orderId);
  if (!order) redirect("/");
  // eTransfer is settled by hand between the buyer and Katie; with no email on
  // the order (Buy now, before Stripe's page) nobody could reach the buyer.
  if (!order.customerEmail?.trim()) redirect(`/orders/${orderId}?card=etransfer_needs_email`);
  try {
    await switchOrderToEtransfer({ orderId, dueHours: siteConfig.etransferDueHours });
  } catch (err) {
    console.error("[katie-the-potter] payOrderByEtransfer:", err);
    redirect(`/orders/${orderId}?card=etransfer_unavailable`);
  }
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}
