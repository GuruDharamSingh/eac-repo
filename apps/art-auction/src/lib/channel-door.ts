"use server";

import { revalidatePath } from "next/cache";
import { performSiteChannelAction } from "@elkdonis/actions/server";
import type { ActionResult } from "@elkdonis/actions";
import { SITE_DOOR_ALLOW } from "@elkdonis/channel/site/view";
import { siteConfig } from "@/config/site";
import { getCurrentUser, isMarketKeeper } from "@/lib/marketplace-auth";
import { marketPlanProposals } from "@/lib/market-channel";

/**
 * The market's Channel door (Content cornerstone Step 4, 2026-11-26), as Para Theater's lib/channel-door.ts. The
 * actor is the verified session's user and the org is always the marketplace org. Two gates: a keeper (a platform
 * admin or an owner of the market org), then performSiteChannelAction, which settles only for an owner or guide of
 * that org. Entries: SITE_DOOR_ALLOW. Every one writes plans only; nothing is sent.
 */
export async function runChannelAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !(await isMarketKeeper(user.id))) {
    return { ok: false, error: "Only the market's keepers run its channel.", code: "forbidden" };
  }
  const result = await performSiteChannelAction(
    { orgId: siteConfig.marketplaceOrgId },
    { userId: user.id, email: user.email ?? "" },
    String(id),
    input,
    { allow: SITE_DOOR_ALLOW, sources: { channelPlanProposals: marketPlanProposals } },
  );
  if (result.ok) revalidatePath("/admin/content");
  return result;
}
