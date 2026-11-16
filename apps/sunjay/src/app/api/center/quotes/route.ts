import { quoteRoutes } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

/**
 * Add a line to the rotating band on /center. Anyone signed in; it lands
 * `pending` until an owner or guide publishes it. The handler is `quoteRoutes`
 * in @elkdonis/services; filed under THIS org, never the collective.
 */
export const dynamic = "force-dynamic";

export const { POST } = quoteRoutes({
  orgId: siteConfig.orgId,
  who: async () => {
    const v = await getViewer();
    return v ? { userId: v.userId, role: v.role } : null;
  },
});
