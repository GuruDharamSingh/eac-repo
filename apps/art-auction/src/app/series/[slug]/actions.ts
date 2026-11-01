"use server";

import { revalidatePath } from "next/cache";
import { getSeriesBySlug } from "@elkdonis/commerce/queries";
import { setSeriesFollow, postSeriesReply, decideSeriesOrg } from "@elkdonis/commerce/server";
import { getCurrentUserId } from "@/lib/marketplace-auth";

// Actions anyone signed in may take on the series page: follow, post to the
// discussion, answer an organisation's invitation.

type Result = { ok: boolean; error?: string };

export async function followSeriesAction(slug: string, on: boolean): Promise<Result & { following?: boolean }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Sign in to follow this series." };
  const series = await getSeriesBySlug(slug);
  if (!series || series.status !== "published") return { ok: false, error: "This series is not published." };
  try {
    const following = await setSeriesFollow(series.id, userId, on);
    revalidatePath(`/series/${slug}`);
    return { ok: true, following };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function replySeriesAction(slug: string, text: string, parentId?: string | null): Promise<Result> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Sign in to join the discussion." };
  const series = await getSeriesBySlug(slug);
  if (!series || series.status !== "published") return { ok: false, error: "The discussion opens when the series is published." };
  const r = await postSeriesReply(series.id, userId, text, parentId ?? null);
  if (r.ok) revalidatePath(`/series/${slug}`);
  return r;
}

export async function decideInvitationAction(slug: string, seriesId: string, orgId: string, accept: boolean): Promise<Result> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Sign in first." };
  const r = await decideSeriesOrg(seriesId, orgId, userId, accept);
  if (r.ok) {
    revalidatePath(`/series/${slug}`, "layout");
    revalidatePath(`/series/${slug}/invitations`);
  }
  return r;
}
