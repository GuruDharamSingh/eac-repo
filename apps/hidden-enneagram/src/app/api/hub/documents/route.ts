import { hubDocumentRoutes } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getApiMember } from "@/lib/auth";

/**
 * The group living documents, members only (the share link is the permission).
 * The handler is hubDocumentRoutes in @elkdonis/services.
 */
export const dynamic = "force-dynamic";

export const { GET, POST, PATCH } = hubDocumentRoutes({
  orgId: siteConfig.orgId,
  who: async () => {
    const v = await getApiMember();
    return v ? { userId: v.userId, email: v.email } : null;
  },
});
