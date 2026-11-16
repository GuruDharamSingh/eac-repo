import type { NextRequest } from "next/server";
import { isOccurrenceHost, uploadRoutes } from "@elkdonis/services";
import { db } from "@elkdonis/db";
import type { SeriesSite } from "../config";
import { apiMember } from "../config";

/**
 * Uploads into the ORG's media tree (`EAC_Network/<org>/Media/...`), as opposed
 * to `/api/upload`, which puts a file in an ARTIST's own folder.
 *
 * Owner/guide, or (2026-10-10) a member who hosts or co-hosts the week named
 * by `threadId` + `occurrenceAt`: the week page's in-place editor uploads that
 * week's cover and materials. The thread must be this org's, and the host row
 * is read from meeting_hosts, not taken from the client.
 *
 * The storage logic is `uploadRoutes` kind `site` (services): sniffed type,
 * counted-byte caps, SVG refused, library row through `registerLibraryItem`.
 * This factory keeps the series-site signature and the legacy response shape
 * (`name` is the ORIGINAL file name, `type` the media category).
 */
export function mediaUploadRoutes(site: SeriesSite) {
  const ORG_ID = site.orgId;

  const routes = uploadRoutes({
    orgId: ORG_ID,
    who: async () => {
      const m = await apiMember(site);
      return m ? { userId: m.userId, canEdit: m.canEdit } : null;
    },
    kinds: ["site"],
    defaultKind: "site",
    unauthorized: { status: 401, error: "Unauthorized" },
    authorize: async ({ viewer, form }) => {
      if (viewer.canEdit) return true;
      const threadId = String(form.get("threadId") ?? "");
      const occurrenceAt = String(form.get("occurrenceAt") ?? "");
      if (!threadId || !occurrenceAt || Number.isNaN(Date.parse(occurrenceAt))) return false;
      const [thread] = await db<Array<{ id: string }>>`
        SELECT id FROM threads WHERE id = ${threadId} AND org_id = ${ORG_ID}
      `;
      return Boolean(thread) && (await isOccurrenceHost(threadId, occurrenceAt, viewer.userId));
    },
    respond: (r) => ({ success: true, id: r.id, url: r.url, path: r.path, type: r.mediaType, name: r.filename }),
  });

  async function POST(request: NextRequest) {
    return routes.POST(request);
  }

  return { POST };
}
