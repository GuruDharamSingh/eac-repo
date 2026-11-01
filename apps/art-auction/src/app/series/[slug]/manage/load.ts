import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getSeriesBySlug, type AuctionSeries } from "@elkdonis/commerce/queries";
import { canEditSeries } from "@elkdonis/commerce/server";
import { getCurrentUserId } from "@/lib/marketplace-auth";

/**
 * The series and the signed-in editor, for every workspace page. Access is
 * the series' own (canEditSeries: an editor on its team, an owner of the
 * auction org, a network admin), not `/admin`'s is_admin gate, so the
 * presenting org's desk can run its series.
 */
export const loadWorkspace = cache(async (slug: string): Promise<{ series: AuctionSeries; userId: string }> => {
  const userId = await getCurrentUserId();
  if (!userId) redirect(`/login?next=/series/${slug}/manage`);
  const series = await getSeriesBySlug(slug);
  if (!series) notFound();
  if (!(await canEditSeries(userId, series.id))) notFound();
  return { series, userId };
});
