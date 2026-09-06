"use server";

import { revalidatePath } from "next/cache";
import { approveStore, rejectStore } from "@elkdonis/commerce/server";
import { requireAdmin } from "@/lib/marketplace-auth";

export async function approveApplicationAction(
  storeId: string
): Promise<{ ok: boolean; error?: string }> {
  const reviewerId = await requireAdmin();
  try {
    await approveStore(storeId, reviewerId);
    revalidatePath("/admin/applications");
    revalidatePath("/artists");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function rejectApplicationAction(
  storeId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const reviewerId = await requireAdmin();
  if (!reason.trim()) return { ok: false, error: "A reason is required." };
  try {
    await rejectStore(storeId, reviewerId, reason.trim());
    revalidatePath("/admin/applications");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}
