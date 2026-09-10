import {
  createOrgFolder,
  deleteOrgFile,
  listOrgFiles,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * The IFAC shared drive.
 *
 * Scoped to the org root by construction: the caller passes a path RELATIVE to
 * `EAC_Network/ifac`, and `resolveOrgPath` (inside the service) throws on
 * anything that tries to climb out. The org id is never taken from the request.
 *
 * Note this is stricter than inner-gathering's equivalent route, which lets any
 * signed-in user of that app read its `Private/` tree. Membership is checked
 * here on every call, reads included.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();

  const path = new URL(request.url).searchParams.get("path") ?? "";
  try {
    const files = await listOrgFiles(siteConfig.orgId, path);
    return Response.json({ path, files, canEdit: viewer.canEdit });
  } catch (error) {
    // A traversal attempt throws here. Answer 400, not 500: the request is
    // malformed, the server is fine.
    console.error("[ifac] hub/files list:", error);
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();
  // Reading the drive is a member right; reshaping it is not.
  if (!viewer.canEdit) return forbidden("Only owners and guides can change the drive");

  let payload: { action?: string; path?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  const path = (payload.path ?? "").trim();
  if (!path) return Response.json({ error: "A path is required" }, { status: 400 });

  try {
    if (payload.action === "createFolder") {
      const ok = await createOrgFolder(siteConfig.orgId, path);
      return ok
        ? Response.json({ ok: true })
        : Response.json({ error: "Could not create that folder" }, { status: 400 });
    }
    if (payload.action === "delete") {
      const ok = await deleteOrgFile(siteConfig.orgId, path);
      return ok
        ? Response.json({ ok: true })
        : Response.json({ error: "Could not delete that" }, { status: 400 });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[ifac] hub/files write:", error);
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }
}
