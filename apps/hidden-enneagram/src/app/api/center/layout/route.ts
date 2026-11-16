import { centerLayoutRoutes } from "@elkdonis/services";
import { isAdmin } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

/**
 * The center definition, read and written from the arranging surface. The
 * handler is centerLayoutRoutes in @elkdonis/services.
 */
export const dynamic = "force-dynamic";

export const { GET, PATCH } = centerLayoutRoutes({
  orgId: siteConfig.orgId,
  who: async () => {
    const v = await getViewer();
    return v ? { userId: v.userId } : null;
  },
  isAdmin,
});
