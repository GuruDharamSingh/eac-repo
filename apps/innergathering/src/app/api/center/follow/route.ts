import { followRoutes } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

/**
 * Follow / unfollow this org from /center. The handler is `followRoutes` in
 * @elkdonis/services (a follow is a `viewer` row; unfollow only removes one).
 */
export const dynamic = "force-dynamic";

export const { POST, DELETE } = followRoutes({
  orgId: siteConfig.orgId,
  who: async () => {
    const v = await getViewer();
    return v ? { userId: v.userId, role: v.role } : null;
  },
});
