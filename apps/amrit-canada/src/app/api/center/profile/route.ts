import { profileRoutes } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

/**
 * The profile surface read and write: the person's own network identity, or
 * ?org=<id> for an organisation. The handler is profileRoutes in
 * @elkdonis/services.
 */
export const dynamic = "force-dynamic";

export const { GET, PATCH } = profileRoutes({
  who: async () => {
    const v = await getViewer();
    return v ? { userId: v.userId } : null;
  },
  marketplaceUrl: siteConfig.marketplaceUrl,
});
