"use server";

/**
 * Admin refund from /hub/admin/sales (2026-11-27, agent G).
 *
 * The one write on this page. It goes through the registry entry `sales-refund`
 * (@elkdonis/actions), which holds the rules: network admin only, host door
 * only, status checked before Stripe, then refundStripeOrder for a paid card
 * order (or refundOrder when card payment is not configured). The actor is the
 * verified session's user; nothing in the arguments names one.
 *
 * `refundStripeOrder` and `isCardPaymentAvailable` live in @elkdonis/checkout,
 * which @elkdonis/actions does not depend on, so they are handed in here as
 * `sources.orderRefund`. Without them the entry refuses, so the generic
 * runAction door cannot refund.
 */

import { revalidatePath } from "next/cache";
import { performAction } from "@elkdonis/actions/server";
import type { ActionResult } from "@elkdonis/actions";
import { getCurrentUser } from "@/lib/session";

export async function refundSaleAction(orderId: string, reason: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first.", code: "auth" };
  const { isCardPaymentAvailable, refundStripeOrder } = await import("@elkdonis/checkout/stripe");
  const result = await performAction(
    "sales-refund",
    {
      userId: user.id,
      email: user.email,
      via: "app",
      sources: {
        orderRefund: {
          cardAvailable: isCardPaymentAvailable,
          refundStripe: (q) => refundStripeOrder(q),
        },
      },
    },
    { orderId: String(orderId ?? ""), reason: String(reason ?? "") },
  );
  if (result.ok === true) revalidatePath("/hub/admin/sales");
  return result;
}
