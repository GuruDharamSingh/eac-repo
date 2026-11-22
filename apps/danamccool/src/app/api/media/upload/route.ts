import { mediaUploadRoute } from "@elkdonis/services";
import { getSiteOwnerUserId, getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Image upload for the page editor and the gallery pages (user_galleries, via
 * @elkdonis/cms-ui/gallery's uploadEndpoint). The handler is shared
 * (packages/services/src/media-upload-route.ts); this is where it becomes
 * Dana's.
 *
 * Gated like every write here: getViewer().canEdit (owner/guide on org
 * `danamccool`). WHERE files go: this is her personal site, so everything is
 * hers whoever did the uploading (`media.uploaded_by` still records that):
 * EAC_Network/users/<her storage slug>/
 *
 *   no `gallery`      -> Media/Images/        (what "My images" lists)
 *   `gallery=<slug>`  -> Galleries/<slug>/    (that gallery's own folder)
 */
export const { POST } = mediaUploadRoute({
  orgId: siteConfig.orgId,
  label: "danamccool",
  target: "owner",
  ownerUserId: getSiteOwnerUserId,
  canEdit: async () => {
    const viewer = await getViewer();
    return viewer?.canEdit ? { userId: viewer.userId } : null;
  },
});
