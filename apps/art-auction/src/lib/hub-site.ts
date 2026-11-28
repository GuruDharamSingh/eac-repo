import { db } from "@elkdonis/db";
import type { HubSite, HubViewer } from "@elkdonis/hub/contract";
import { siteConfig } from "@/config/site";
import { getCurrentUserId, isMarketKeeper } from "@/lib/marketplace-auth";
import { contentHost } from "@/lib/content-host";

/** Collect Art as a hub-card site (the plain object the shared cards take). */
export const hubSite: HubSite = {
  orgId: siteConfig.marketplaceOrgId,
  name: siteConfig.name,
  mark: "CA",
  domain: contentHost.site.domain,
  baseUrl: `https://${contentHost.site.domain}`,
  basePath: "",
  timeZone: contentHost.site.timeZone,
  features: {},
};

/**
 * The signed-in person as the cards see them; null when signed out. Keepers (a platform admin or an owner of the
 * marketplace org) get role "owner", which is what opens the cards' site lens; `isNetworkAdmin` is `users.is_admin`.
 */
export async function getHubCardViewer(): Promise<HubViewer | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const [row] = (await db`
    SELECT display_name, email, is_admin FROM users WHERE id = ${userId} LIMIT 1
  `) as unknown as Array<{ display_name: string | null; email: string | null; is_admin: boolean | null }>;
  const keeper = await isMarketKeeper(userId);
  return {
    userId,
    name: row?.display_name || row?.email || "You",
    role: keeper ? "owner" : null,
    isNetworkAdmin: Boolean(row?.is_admin),
  };
}
