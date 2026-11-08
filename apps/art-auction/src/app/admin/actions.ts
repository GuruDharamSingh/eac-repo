"use server";

import { revalidatePath } from "next/cache";
import {
  adminHideArtwork,
  adminShowArtwork,
  approveStore,
  cancelOrder,
  confirmOrderPaid,
  markOrderFulfilled,
  pauseStore,
  refundOrder,
} from "@elkdonis/commerce/server";
import { getOrderById } from "@elkdonis/commerce/queries";
import { isCardPaymentAvailable, refundStripeOrder } from "@elkdonis/checkout/stripe";
import { requireAdmin, requireKeeper } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";

type Result = { ok: boolean; error?: string };

function fail(err: unknown): Result {
  return { ok: false, error: err instanceof Error ? err.message : "Failed." };
}

function touch(orderId?: string) {
  revalidatePath("/admin", "layout");
  revalidatePath("/studio", "layout");
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
    revalidatePath("/");
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
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// Show / hide (marketplace keepers: admins and owners of the market org).
// Pausing a store drops its work from browse and blocks new orders; nothing is deleted.
export async function adminPauseStore(storeId: string): Promise<void> {
  const { userId: adminId } = await requireKeeper();
  await pauseStore(storeId, adminId);
  touch();
  revalidatePath("/");
}

export async function adminReactivateStore(storeId: string): Promise<void> {
  const { userId: adminId } = await requireKeeper();
  await approveStore(storeId, adminId);
  touch();
  revalidatePath("/");
}

/** Hide one artwork from the public site (reversible; see `adminHideArtwork`). */
export async function adminHideArtworkAction(artworkId: string): Promise<void> {
  const { userId } = await requireKeeper();
  await adminHideArtwork(artworkId, userId, siteConfig.marketplaceOrgId);
  touch();
  revalidatePath("/");
  revalidatePath(`/artworks/${artworkId}`);
}

export async function adminShowArtworkAction(artworkId: string): Promise<void> {
  await requireKeeper();
  await adminShowArtwork(artworkId, siteConfig.marketplaceOrgId);
  touch();
  revalidatePath("/");
  revalidatePath(`/artworks/${artworkId}`);
}

// ─── Money (ledger, settings, beneficiaries) ─────────────────────────────────
// All of these are network-admin only (`requireAdmin`): releasing held money
// and recording payouts are the two things an org must not do for itself.

export async function adminRecordPayout(input: {
  partyKind: "user" | "org" | "payee";
  partyId: string;
  amountMajor: number;
  method: string;
  reference?: string;
  note?: string;
}): Promise<Result> {
  try {
    const adminId = await requireAdmin();
    const { recordPayout } = await import("@elkdonis/commerce/server");
    const party =
      input.partyKind === "user"
        ? { kind: "user" as const, userId: input.partyId }
        : input.partyKind === "org"
          ? { kind: "org" as const, orgId: input.partyId }
          : { kind: "payee" as const, payeeId: input.partyId };
    const r = await recordPayout({
      party,
      amountMinor: Math.round(Number(input.amountMajor) * 100),
      method: input.method.trim() || "etransfer",
      reference: input.reference?.trim() || null,
      note: input.note?.trim() || null,
      actorUserId: adminId,
    });
    if (r.ok) {
      revalidatePath("/admin/money");
      // A beneficiary paid over gets its follow-up statement (R2).
      if (input.partyKind === "payee") {
        const { sendPaidProceedsStatements } = await import("@elkdonis/commerce/server");
        void sendPaidProceedsStatements(input.partyId);
      }
    }
    return r;
  } catch (err) {
    return fail(err);
  }
}

export async function adminReleaseHold(entryId: string, note?: string): Promise<Result> {
  try {
    const adminId = await requireAdmin();
    const { releaseHold } = await import("@elkdonis/commerce/server");
    const r = await releaseHold({ entryId, releasedBy: adminId, note: note?.trim() || undefined });
    if (r.ok) revalidatePath("/admin/money");
    return r;
  } catch (err) {
    return fail(err);
  }
}

export async function adminSaveMarketplaceSettings(input: {
  defaultCommissionRate: number;
  softCloseMinutes: number;
  paymentWindowHours: number;
  applyToStores: boolean;
}): Promise<Result> {
  try {
    const adminId = await requireAdmin();
    const { updateMarketplaceSettings } = await import("@elkdonis/commerce/server");
    const r = await updateMarketplaceSettings({
      actorUserId: adminId,
      defaultCommissionRate: Number(input.defaultCommissionRate),
      softCloseMinutes: Math.max(0, Math.round(Number(input.softCloseMinutes))),
      paymentWindowHours: Math.max(1, Math.round(Number(input.paymentWindowHours))),
      applyToStores: Boolean(input.applyToStores),
    });
    if (r.ok) revalidatePath("/admin/money");
    return r;
  } catch (err) {
    return fail(err);
  }
}

export async function adminApprovePayee(payeeId: string): Promise<Result> {
  try {
    const adminId = await requireAdmin();
    const { approvePayee } = await import("@elkdonis/commerce/server");
    const r = await approvePayee(payeeId, adminId);
    if (r.ok) revalidatePath("/admin/money");
    return r;
  } catch (err) {
    return fail(err);
  }
}

/** Who buys the label for a store's sales (migration 250). Network admins only. */
export async function adminSetStoreShippingMode(storeId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const mode = String(formData.get("mode") ?? "");
  const { setStoreShippingMode, SHIPPING_MODES } = await import("@elkdonis/commerce/shipping");
  if (!(SHIPPING_MODES as string[]).includes(mode)) return;
  await setStoreShippingMode(storeId, mode as (typeof SHIPPING_MODES)[number]);
  touch();
}
