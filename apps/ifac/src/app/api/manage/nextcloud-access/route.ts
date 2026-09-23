import { createNextcloudAccessRoutes } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET: who in IFAC is linked to Nextcloud; POST: ask for a sync.
 * Owner of IFAC AND the network admin has granted IFAC 'nextcloud_access' —
 * both checked inside the shared factory, not here.
 */
export const { GET, POST } = createNextcloudAccessRoutes({
  orgId: siteConfig.orgId,
  viewer: async () => {
    const v = await getViewer();
    return v ? { userId: v.userId } : null;
  },
});
