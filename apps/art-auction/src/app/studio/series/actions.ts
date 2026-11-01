"use server";

import { revalidatePath } from "next/cache";
import { attachPublication, detachPublication } from "@elkdonis/commerce/server";
import { getCurrentUserId } from "@/lib/marketplace-auth";

export async function attachPublicationAction(seriesId: string, threadId: string, weekNo: number | null): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Sign in required." };
  const r = await attachPublication({ seriesId, userId, threadId, weekNo });
  if (r.ok) revalidatePath("/studio/series");
  return r;
}

export async function detachPublicationAction(seriesId: string, slotId: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Sign in required." };
  const r = await detachPublication({ seriesId, userId, slotId });
  if (r.ok) revalidatePath("/studio/series");
  return r;
}
