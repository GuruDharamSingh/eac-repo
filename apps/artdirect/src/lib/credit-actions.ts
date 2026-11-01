"use server";

import { revalidatePath } from "next/cache";
import { rejectArtworkCredit } from "@elkdonis/commerce/server";
import { getProfile } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * The signed-in person declines a credit on a piece in someone else's store
 * (migration 209, ORG_STORE_BRIEF D4). The commerce layer checks that they
 * are the credited person; the listing itself is untouched.
 */
export async function declineCreditAction(artworkId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in required." };
  const r = await rejectArtworkCredit(artworkId, user.id);
  if (r.ok) {
    const profile = await getProfile(user.id).catch(() => null);
    if (profile?.slug) revalidatePath(`/${profile.slug}`);
  }
  return r;
}
