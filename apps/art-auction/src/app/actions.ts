"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import {
  clearCartToken,
  readCartToken,
  withCartToken,
} from "@elkdonis/checkout/server";
import type { CheckoutFormValues } from "@elkdonis/checkout";
import {
  addToCart,
  createEtransferOrder,
  placeBid,
  removeCartLine,
} from "@elkdonis/commerce/server";
import { siteConfig } from "@/config/site";

async function currentUserId(): Promise<string | null> {
  try {
    const session = await getServerSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Add an artwork variant to the cart. Wired to BuyNowButton.onAdd. */
export async function addArtworkToCart(input: {
  artworkId: string;
  artworkVariantId: string;
}): Promise<{ cartToken: string; redirectTo: string }> {
  const userId = await currentUserId();
  const cartToken = await withCartToken(
    async (token) => {
      await addToCart({ cartToken: token, artworkVariantId: input.artworkVariantId });
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

/** Convert the current cart into an eTransfer order, then go to confirmation. */
export async function placeOrder(values: CheckoutFormValues): Promise<void> {
  const token = await readCartToken();
  if (!token) throw new Error("Your cart is empty.");
  const userId = await currentUserId();

  const order = await createEtransferOrder({
    cartToken: token,
    customerEmail: values.customerEmail,
    customerName: values.customerName,
    customerId: userId,
    shippingAddress: values.shippingAddress,
    notes: values.notes ?? null,
    etransferDueHours: siteConfig.etransferDueHours,
  });

  await clearCartToken();
  redirect(`/orders/${order.id}`);
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
