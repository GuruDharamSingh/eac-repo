import { createCollectHandler } from "@elkdonis/analytics/route";
import { siteConfig } from "@/config/site";

// First-party analytics collector (packages/analytics).
export const POST = createCollectHandler({ defaultOrgId: siteConfig.orgId });
