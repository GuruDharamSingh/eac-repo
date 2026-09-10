"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import {
  clearCartToken,
  readCartToken,
  withCartToken,
} from "@elkdonis/checkout/server";
import {
  isCardPaymentAvailable,
  startStripeCheckout,
} from "@elkdonis/checkout/stripe";
import type { CheckoutFormValues } from "@elkdonis/checkout";
import {
  addToCart,
  createOrderFromCart,
  placeBid,
  removeCartLine,
  setArtworkFavorite,
  switchOrderToEtransfer,
} from "@elkdonis/commerce/server";
import { siteConfig } from "@/config/site";

async function currentUserId(): Promise<string | null> {
  try {
    const session = await getServerSession();
    return session?.user?.db_user_id ?? session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Add an artwork variant to the cart. Wired to BuyNowButton.onAdd, bound
 * with the presenting store (`?via=`) when the buyer came through another
 * store's front — see migration 112.
 */
export async function addArtworkToCart(
  viaStoreId: string | null,
  input: {
    artworkId: string;
    artworkVariantId: string;
  }
): Promise<{ cartToken: string; redirectTo: string }> {
  const userId = await currentUserId();
  const cartToken = await withCartToken(
    async (token) => {
      await addToCart({ cartToken: token, artworkVariantId: input.artworkVariantId, viaStoreId });
      return token;
    },
    { userId }
  );
  revalidatePath("/cart");
  return { cartToken, redirectTo: "/cart" };
}

/** Remove a line from the cart. */
export async function removeFromCart(lineId: string): Promise<void> {
  await removeCartLine({ lineId });
  revalidatePath("/cart");
}

/**
 * Toggle whether the signed-in user has favourited an artwork. Returns the new
 * state, or `needsAuth` when the visitor isn't signed in so the UI can prompt.
 */
export async function toggleFavoriteAction(input: {
  artworkId: string;
  favorited: boolean;
}): Promise<{ ok: boolean; favorited?: boolean; needsAuth?: boolean }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, needsAuth: true };
  const res = await setArtworkFavorite({
    userId,
    artworkId: input.artworkId,
    favorited: input.favorited,
  });
  revalidatePath("/account");
  revalidatePath(`/artworks/${input.artworkId}`);
  return { ok: true, favorited: res.favorited };
}

function orderUrl(orderId: string, query = ""): string {
  return `${siteConfig.url.replace(/\/$/, "")}/orders/${orderId}${query}`;
}

/**
 * Convert the current cart into an order on the rail the buyer chose, then
 * either hand them to Stripe or to the eTransfer instructions.
 */
export async function placeOrder(values: CheckoutFormValues): Promise<void> {
  const token = await readCartToken();
  if (!token) throw new Error("Your cart is empty.");
  const userId = await currentUserId();

  const rail = values.paymentMethod === "stripe" && isCardPaymentAvailable() ? "stripe" : "etransfer";
  if (values.paymentMethod === "stripe" && rail !== "stripe") {
    throw new Error("Card payments are not available right now. Please pay by eTransfer.");
  }

  const order = await createOrderFromCart({
    cartToken: token,
    paymentMethod: rail,
    customerEmail: values.customerEmail,
    customerName: values.customerName,
    customerId: userId,
    shippingAddress: values.shippingAddress,
    notes: values.notes ?? null,
    etransferDueHours: siteConfig.etransferDueHours,
    payUrl: orderUrl(""),
  });

  await clearCartToken();

  if (rail === "stripe") {
    const { url } = await startStripeCheckout({
      orderId: order.id,
      successUrl: orderUrl(order.id, "?paid=1"),
      cancelUrl: orderUrl(order.id, "?cancelled=1"),
      imageBase: siteConfig.url,
    });
    redirect(url);
  }
  redirect(`/orders/${order.id}`);
}

/** From the order page: pay (or retry paying) an unpaid order by card. */
export async function payOrderByCard(orderId: string): Promise<void> {
  if (!isCardPaymentAvailable()) {
    throw new Error("Card payments are not available right now.");
  }
  const { url } = await startStripeCheckout({
    orderId,
    successUrl: orderUrl(orderId, "?paid=1"),
    cancelUrl: orderUrl(orderId, "?cancelled=1"),
    imageBase: siteConfig.url,
  });
  redirect(url);
}

/** From the order page: switch an unpaid order to eTransfer instructions. */
export async function payOrderByEtransfer(orderId: string): Promise<void> {
  await switchOrderToEtransfer({ orderId, dueHours: siteConfig.etransferDueHours });
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

/** Place a bid on an auction lot. Wired to BidWidget.onPlaceBid. Bidding requires sign-in. */
export async function placeBidAction(input: {
  lotId: string;
  amountMinor: number;
  maxAmountMinor?: number | null;
}) {
  const userId = await currentUserId();
  if (!userId) {
    return { ok: false as const, reason: "Please sign in to place a bid." };
  }
  const result = await placeBid({
    lotId: input.lotId,
    bidderId: userId,
    amountMinor: input.amountMinor,
    maxAmountMinor: input.maxAmountMinor ?? null,
  });
  revalidatePath(`/lots/${input.lotId}`);
  return result;
}
