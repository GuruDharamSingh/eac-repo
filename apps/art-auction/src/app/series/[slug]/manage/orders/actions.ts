"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  setSeriesOrderHandover,
  setSeriesOrderReceived,
  canConfirmSeriesPayment,
  confirmOrderPaid,
  isNetworkAdmin,
  canEditSeries,
  recordPayout,
  type HandoverMethod,
} from "@elkdonis/commerce/server";
import { getCurrentUserId } from "@/lib/marketplace-auth";

// Orders, fulfilment and payouts from the series workspace. Hand-over and
// receipt: series editors. Confirming a manual payment: an admin or a manager
// of the selling store. Recording a payout: network admins only, as in
// Admin → Money (the collective holds the money).

type Result = { ok: boolean; error?: string };

function fail(err: unknown): Result {
  return { ok: false, error: err instanceof Error ? err.message : "Failed." };
}

async function actor(slug: string): Promise<string> {
  const id = await getCurrentUserId();
  if (!id) redirect(`/login?next=/series/${slug}/manage/orders`);
  return id;
}

function touch(slug: string, orderId?: string) {
  revalidatePath(`/series/${slug}/manage`, "layout");
  if (orderId) revalidatePath(`/orders/${orderId}`);
}

export async function setHandoverAction(seriesId: string, slug: string, orderId: string, method: HandoverMethod, tracking?: string | null): Promise<Result> {
  try {
    const r = await setSeriesOrderHandover({ seriesId, actorUserId: await actor(slug), orderId, method, tracking: tracking ?? null });
    if (r.ok) touch(slug, orderId);
    return r;
  } catch (err) {
    return fail(err);
  }
}

export async function setReceivedAction(seriesId: string, slug: string, orderId: string, received: boolean): Promise<Result> {
  try {
    const r = await setSeriesOrderReceived({ seriesId, actorUserId: await actor(slug), orderId, received });
    if (r.ok) touch(slug, orderId);
    return r;
  } catch (err) {
    return fail(err);
  }
}

export async function confirmPaidAction(seriesId: string, slug: string, orderId: string, method: "etransfer" | "manual", reference?: string): Promise<Result> {
  try {
    const userId = await actor(slug);
    if (!(await canConfirmSeriesPayment(userId, seriesId, orderId))) {
      return { ok: false, error: "Only a network admin or a manager of the selling store can confirm a payment." };
    }
    await confirmOrderPaid({
      orderId,
      confirmedByUserId: userId,
      method,
      paymentReference: reference?.trim() || undefined,
      notes: "from the series workspace",
    });
    touch(slug, orderId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function recordArtistPayoutAction(input: {
  seriesId: string;
  slug: string;
  artistUserId: string;
  amountMajor: number;
  method: string;
  reference?: string;
  note?: string;
}): Promise<Result> {
  try {
    const userId = await actor(input.slug);
    if (!(await isNetworkAdmin(userId)) || !(await canEditSeries(userId, input.seriesId))) {
      return { ok: false, error: "Only a network admin records payouts." };
    }
    const r = await recordPayout({
      party: { kind: "user", userId: input.artistUserId },
      amountMinor: Math.round(Number(input.amountMajor) * 100),
      method: input.method.trim() || "etransfer",
      reference: input.reference?.trim() || null,
      note: input.note?.trim() || null,
      actorUserId: userId,
    });
    if (r.ok) {
      touch(input.slug);
      revalidatePath("/admin/money");
    }
    return { ok: r.ok, error: r.error };
  } catch (err) {
    return fail(err);
  }
}
