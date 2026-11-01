"use server";

import { revalidatePath } from "next/cache";
import { getSeriesBySlug } from "@elkdonis/commerce/queries";
import { canEditSeries } from "@elkdonis/commerce/server";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { canEditHome, saveHeroSettings } from "@/lib/home-hero";

/**
 * Which artists the landing hero features: owners of the marketplace org and
 * network admins, or (from a series workspace's Features page) an editor of
 * that series, since the hero is the season's front.
 */
export async function saveHeroAction(featuredStoreIds: string[], viaSeriesSlug?: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  let allowed = await canEditHome(userId);
  if (!allowed && userId && viaSeriesSlug) {
    const series = await getSeriesBySlug(viaSeriesSlug);
    allowed = Boolean(series) && (await canEditSeries(userId, series!.id));
  }
  if (!allowed) return { ok: false, error: "Only the site's owners or the series' editors can change this." };
  try {
    await saveHeroSettings({ featuredStoreIds });
    revalidatePath("/");
    revalidatePath("/admin/pages");
    if (viaSeriesSlug) revalidatePath(`/series/${viaSeriesSlug}/manage/features`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save." };
  }
}
