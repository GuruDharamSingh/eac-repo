import type { WhiteboardCloudSave } from "@elkdonis/cms-ui/whiteboard";
import { siteConfig } from "@/config/site";

/**
 * Where the whiteboard's "Save to…" / "Export image…" put a file when the
 * member picks Nextcloud. The route is src/app/api/hub/whiteboard/export.
 */
export const WHITEBOARD_CLOUD_SAVE: WhiteboardCloudSave = {
  endpoint: "/api/hub/whiteboard/export",
  folderLabel: `${siteConfig.orgName} › Private › Whiteboards`,
};
