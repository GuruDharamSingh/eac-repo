import { whiteboardRoutes } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getApiMember } from "@/lib/auth";

/**
 * The group's shared whiteboard: one Excalidraw scene, org-wide, any member.
 * The handler is `whiteboardRoutes` in @elkdonis/services.
 */
export const dynamic = "force-dynamic";

export const { GET, PUT } = whiteboardRoutes({
  orgId: siteConfig.orgId,
  who: async () => {
    const v = await getApiMember();
    return v ? { userId: v.userId } : null;
  },
});
