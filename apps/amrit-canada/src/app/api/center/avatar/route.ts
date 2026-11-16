import { uploadRoutes } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * A display image for the profile surface. Any signed-in person may upload;
 * the image goes through the one upload path (services uploads.ts, kind
 * "avatar"): sniffed, re-encoded to at most 1024 px with metadata removed,
 * stored in the person's OWN tree. Send scope=org to store it as this site's
 * org-specific avatar instead (falls back to the network avatar when unset).
 * Design: docs/open/UPLOADS_ONE_PATH_2026-11-16.md
 */
export const dynamic = "force-dynamic";

export const { POST } = uploadRoutes({
  orgId: siteConfig.orgId,
  who: async () => {
    const viewer = await getViewer();
    return viewer ? { userId: viewer.userId } : null;
  },
  kinds: ["avatar"],
  defaultKind: "avatar",
});
