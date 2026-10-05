import { createCollectHandler } from "@elkdonis/analytics/route";
import { analyticsOptions } from "@/lib/analytics";

// First-party analytics collector (packages/analytics).
export const POST = createCollectHandler(analyticsOptions);
