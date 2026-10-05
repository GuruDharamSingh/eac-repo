import { createCollectHandler } from "@elkdonis/analytics/route";

// First-party analytics collector (packages/analytics). Hosts with no
// org_domains row and no org subdomain are the network itself: no org_id.
export const POST = createCollectHandler({ defaultOrgId: null });
