"use server";

import { revalidatePath } from "next/cache";
import { siteConfig } from "@/config/site";
import { getHubViewer } from "@/lib/hub-auth";
import { setHubSkin } from "@/lib/hub-skin-store";
import type { HubSkin } from "@/lib/hub-skin";

/**
 * Change the hub's look. Owners and guides only — it is the whole membership's
 * page, not a per-person preference.
 */
export async function saveHubSkinAction(
  skin: HubSkin
): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getHubViewer();
  if (!viewer) return { ok: false, error: "Members only" };
  if (!viewer.canEdit) {
    return { ok: false, error: "Only owners and guides can change the hub's look" };
  }

  try {
    await setHubSkin(siteConfig.orgId, skin);
    // The skin is read in the hub LAYOUT, so the whole members' area
    // revalidates, not just the page the switch was thrown on.
    revalidatePath("/hub", "layout");
    return { ok: true };
  } catch (error) {
    console.error("[ifac] saveHubSkinAction:", error);
    return { ok: false, error: "Could not save that" };
  }
}
