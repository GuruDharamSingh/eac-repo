"use server";

import { revalidatePath } from "next/cache";
import { approveArtist, rejectArtist } from "@elkdonis/commerce/server";
import { requireAdmin } from "@/lib/marketplace-auth";

export async function approveApplicationAction(
  artistUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const reviewerId = await requireAdmin();
  try {
    await approveArtist(artistUserId, reviewerId);
    revalidatePath("/admin/applications");
    revalidatePath("/artists");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function rejectApplicationAction(
  artistUserId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const reviewerId = await requireAdmin();
  if (!reason.trim()) return { ok: false, error: "A reason is required." };
  try {
    await rejectArtist(artistUserId, reviewerId, reason.trim());
    revalidatePath("/admin/applications");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}
