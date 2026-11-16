import { uploadRoutes } from "@elkdonis/services";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Editors' upload into the circle's storage: EAC_Network/<org>/Media/<type>.
 * The logic is `uploadRoutes` kind `site` (sniffed type, counted-byte caps,
 * SVG refused, library row). This file keeps the old URL and response keys.
 */
export const dynamic = "force-dynamic";

export const { POST } = uploadRoutes({
  orgId: siteConfig.orgId,
  who: async () => {
    const editor = await getApiEditor();
    return editor ? { userId: editor.userId, canEdit: true } : null;
  },
  kinds: ["site"],
  defaultKind: "site",
  unauthorized: { status: 403, error: "Not allowed" },
  respond: (r) => ({ ok: true, path: r.path, url: r.url, name: r.name, size: r.size }),
});
