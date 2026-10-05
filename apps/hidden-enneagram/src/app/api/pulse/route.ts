import { createCollectHandler } from "@elkdonis/analytics/route";

// First-party analytics collector (packages/analytics).
export const POST = createCollectHandler({
  forceOrgId: "hidden-enneagram",
});
