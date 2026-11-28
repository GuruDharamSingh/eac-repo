"use server";

import { revalidatePath } from "next/cache";
import { performAction } from "@elkdonis/actions/server";
import { getCurrentUser, requireKeeper } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";

/**
 * The hub cards' one write door on the market. Keepers only (requireKeeper, from the session), and only the two
 * entries the Content card offers (contentHost.actions): any other id is refused. It runs the registry's
 * `artwork-hide` / `artwork-show` through `performAction` (the path the dock and the MCP assistant share), as the
 * session's person, on the marketplace org, bound to this site (`siteOrgId`, via 'app'), so the actor rule and the
 * audit row are the registry's.
 */
export async function runHubAction(id: string, input: Record<string, unknown>) {
  // The redirect for a non-keeper must not be caught below.
  const { userId } = await requireKeeper();
  const artworkId = typeof input?.artworkId === "string" ? input.artworkId : "";
  if ((id !== "artwork-hide" && id !== "artwork-show") || !artworkId) {
    return { ok: false as const, error: "That action is not available here." };
  }
  const user = await getCurrentUser();
  const result = await performAction(
    id,
    { userId, email: user?.email ?? "", orgId: siteConfig.marketplaceOrgId, siteOrgId: siteConfig.marketplaceOrgId, via: "app" },
    { artworkId },
  );
  if (result.ok === false) return { ok: false as const, error: result.error || "That could not be done." };
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  revalidatePath(`/artworks/${artworkId}`);
  return { ok: true as const, value: null };
}
