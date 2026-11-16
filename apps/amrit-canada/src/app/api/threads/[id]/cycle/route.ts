import { cycleRoutes } from "@elkdonis/services";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Confirm or cancel the current occurrence of a recurring gathering. Owner or
 * guide only. The handler is `cycleRoutes` in @elkdonis/services (an
 * append-only row in `thread_cycle_events`).
 */
export const { POST } = cycleRoutes({
  orgId: siteConfig.orgId,
  who: async () => {
    const editor = await getApiEditor();
    return editor ? { userId: editor.userId } : null;
  },
});
