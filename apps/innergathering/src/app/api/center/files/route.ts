import { NextResponse, type NextRequest } from "next/server";
import { getStorageSlug, listOrgFiles, listUserFiles } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

/**
 * Read-only file listing for the hub's page layout (FileBrowser).
 *
 * `scope=org` (default) lists this org's shared tree, `scope=mine` the
 * viewer's own `EAC_Network/users/<slug>`. Members and up only, checked on
 * every call — the same rule as IFAC's /api/hub/files. The path is RELATIVE
 * and `resolveOrgPath` inside the service refuses anything that climbs out;
 * the org and the owner come from the site and the session, never the request.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!viewer.isMember) return NextResponse.json({ error: "Members only" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const path = (params.get("path") ?? "").slice(0, 500);
  const scope = params.get("scope") === "mine" ? "mine" : "org";
  try {
    if (scope === "mine") {
      const slug = await getStorageSlug(viewer.userId);
      const files = slug ? await listUserFiles(slug, path) : [];
      return NextResponse.json({ path, scope, files });
    }
    const files = await listOrgFiles(siteConfig.orgId, path);
    return NextResponse.json({ path, scope, files });
  } catch (err) {
    console.error("[center] files:", err);
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
}
