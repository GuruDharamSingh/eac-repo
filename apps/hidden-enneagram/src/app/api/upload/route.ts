import { uploadRoutes } from "@elkdonis/services";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Owner/guide upload into EAC_Network/<org>/Media. Images, plus audio for the
 * Music tab (60 MB cap). The logic is `uploadRoutes` kind `site`, narrowed.
 */
export const dynamic = "force-dynamic";

const MB = 1024 * 1024;

export const { POST } = uploadRoutes({
  orgId: siteConfig.orgId,
  who: async () => {
    const editor = await getApiEditor();
    return editor ? { userId: editor.userId, canEdit: true } : null;
  },
  kinds: ["site"],
  defaultKind: "site",
  unauthorized: { status: 401, error: "Unauthorized" },
  narrow: { site: { kinds: ["image", "audio"], allowText: false, caps: { image: 25 * MB, audio: 60 * MB } } },
  respond: (r) => ({
    success: true,
    id: r.id,
    url: r.url,
    path: r.path,
    filename: r.filename,
    mimeType: r.mimeType,
    size: r.size,
  }),
});
