"use server";

import { revalidatePath } from "next/cache";
import { performSiteChannelAction } from "@elkdonis/actions/server";
import type { ActionResult } from "@elkdonis/actions";
import { SITE_DOOR_ALLOW } from "@elkdonis/channel/site/view";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { sitePlanProposals } from "@/lib/channel-model";

/**
 * This site's Channel door (2026-11-14; developer, question 5: a site's owners and guides
 * run Channel entries for their own org on their own site). The actor is the verified
 * session's user; the org is always siteConfig.orgId, settled for owners and guides only
 * by performSiteChannelAction. Entries: SITE_DOOR_ALLOW (accept, dismiss, slot-fill,
 * plan-step, plan). Every one writes plans only; nothing is sent.
 */
export async function runChannelAction(id: string, input: unknown): Promise<ActionResult> {
  const viewer = await getViewer().catch(() => null);
  const result = await performSiteChannelAction(
    { orgId: siteConfig.orgId },
    viewer ? { userId: viewer.userId, email: viewer.email } : null,
    String(id),
    input,
    { allow: SITE_DOOR_ALLOW, sources: { channelPlanProposals: sitePlanProposals } },
  );
  if (result.ok) revalidatePath("/channel");
  return result;
}
