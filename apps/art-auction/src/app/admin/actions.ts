"use server";

import { revalidatePath } from "next/cache";
import {
  approveStore,
  cancelOrder,
  confirmOrderPaid,
  markOrderFulfilled,
  pauseStore,
  refundOrder,
} from "@elkdonis/commerce/server";
import { getOrderById } from "@elkdonis/commerce/queries";
import { isCardPaymentAvailable, refundStripeOrder } from "@elkdonis/checkout/stripe";
import { requireAdmin } from "@/lib/marketplace-auth";

type Result = { ok: boolean; error?: string };

function fail(err: unknown): Result {
  return { ok: false, error: err instanceof Error ? err.message : "Failed." };
}

function touch(orderId?: string) {
  revalidatePath("/admin");
  revalidatePath("/studio");
  if (orderId) revalidatePath(`/orders/${orderId}`);
}

export async function adminConfirmOrder(orderId: string, reference?: string): Promise<Result> {
  try {
    const adminId = await requireAdmin();
    await confirmOrderPaid({
      orderId,
      confirmedByUserId: adminId,
      paymentReference: reference?.trim() || undefined,
      notes: "by admin",
    });
    touch(orderId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function adminCancelOrder(orderId: string, reason?: string): Promise<Result> {
  try {
    const adminId = await requireAdmin();
    await cancelOrder({ orderId, actorUserId: adminId, reason: reason?.trim() || "by admin" });
    touch(orderId);
    revalidatePath("/artworks");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function adminFulfilOrder(orderId: string, note?: string): Promise<Result> {
  try {
    const adminId = await requireAdmin();
    await markOrderFulfilled({ orderId, actorUserId: adminId, note: note?.trim() || undefined });
    touch(orderId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Full refund. A card order is refunded through Stripe (destination charge
 * reversed, application fee returned); anything else is recorded, and the
 * money moves by hand.
 */
export async function adminRefundOrder(orderId: string, reason?: string): Promise<Result> {
  try {
    const adminId = await requireAdmin();
    const order = await getOrderById(orderId);
    if (!order) return { ok: false, error: "Order not found." };
    if (order.paymentMethod === "stripe" && isCardPaymentAvailable()) {
      await refundStripeOrder({ orderId, actorUserId: adminId, reason: reason?.trim() || undefined });
    } else {
      await refundOrder({ orderId, actorUserId: adminId, reason: reason?.trim() || "by admin" });
    }
    touch(orderId);
    revalidatePath("/artworks");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function adminPauseStore(storeId: string): Promise<void> {
  const adminId = await requireAdmin();
  await pauseStore(storeId, adminId);
  touch();
  revalidatePath("/artworks");
}

export async function adminReactivateStore(storeId: string): Promise<void> {
  const adminId = await requireAdmin();
  await approveStore(storeId, adminId);
  touch();
  revalidatePath("/artworks");
}
