import { createCollectHandler } from "@elkdonis/analytics/route";

// First-party analytics collector (packages/analytics). The Grand Forum spans
// orgs: a thread's views go to its own org, anything else to no org.
export const POST = createCollectHandler({ defaultOrgId: null });
