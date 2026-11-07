import { isAdmin } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";
import { readCartToken } from "@elkdonis/checkout/server";
import { syncStripeOrder } from "@elkdonis/checkout/stripe";
import { getOrderById } from "@elkdonis/commerce/queries";
import { canActForOrder } from "@elkdonis/commerce/server";
import type { Order } from "@elkdonis/commerce/types";
import { getViewer } from "@/lib/auth";

// Server-only helpers for the buyer journey (cart count, order access).

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How many lines are in this visitor's cart — for the header. Never throws. */
export async function getCartCount(): Promise<number> {
  try {
    const token = await readCartToken();
    if (!token) return 0;
    const [row] = await db<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM cart_line cl JOIN cart c ON c.id = cl.cart_id WHERE c.token = ${token}
    `;
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

/** Whether this cart token owns this cart line (a line id alone is not a capability). */
export async function cartOwnsLine(cartToken: string, lineId: string): Promise<boolean> {
  if (!UUID_RE.test(lineId)) return false;
  const [row] = await db`
    SELECT 1 FROM cart_line cl JOIN cart c ON c.id = cl.cart_id
    WHERE cl.id = ${lineId} AND c.token = ${cartToken} LIMIT 1
  `;
  return Boolean(row);
}

/**
 * The order access rule, copied from the marketplace's /orders/[id]
 * (apps/art-auction/src/app/orders/[id]/page.tsx): a signed-in buyer's order
 * is theirs alone (plus the seller's store team and platform admins). A guest
 * order has no account to check against; its unguessable id is the
 * capability, as it is for the emailed confirmation link.
 *
 * Returns null for "no such order" AND "not yours" alike, so the page can
 * answer 404 for both and an order's existence is never confirmed to a
 * stranger.
 */
export async function loadOrderForViewer(orderId: string, opts: { sync?: boolean } = {}): Promise<Order | null> {
  if (!UUID_RE.test(orderId)) return null;
  // Coming back from Stripe: reconcile against the session so the buyer sees
  // "paid" even if the webhook has not landed yet. Idempotent.
  const order = opts.sync ? await syncStripeOrder(orderId) : await getOrderById(orderId);
  if (!order) return null;
  if (order.customerId) {
    const viewer = await getViewer().catch(() => null);
    const userId = viewer?.userId ?? null;
    const allowed =
      (userId !== null && userId === order.customerId) ||
      (userId ? await canActForOrder(userId, order.id) : false) ||
      (userId ? await isAdmin(userId).catch(() => false) : false);
    if (!allowed) return null;
  }
  return order;
}
