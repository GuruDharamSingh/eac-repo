import { NextResponse, type NextRequest } from "next/server";
import { browseMediaFolder } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * The SITE's pictures, for the picker in the page editor: the org's folder in
 * Nextcloud, browsed a folder at a time (`?path=`) or searched (`?q=`).
 *
 * The org folder in Nextcloud (EAC_Network/katie-the-potter/Media/Images),
 * browsed a folder at a time —
 * nested folders included.
 *
 * The root is fixed here; only the path under it comes from the request, and
 * browseMediaFolder refuses one that tries to leave it. Editors only: a
 * listing reveals the names of work not yet published.
 */
export const dynamic = "force-dynamic";

const ROOT = `EAC_Network/${siteConfig.orgId}/Media/Images`;

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const url = new URL(req.url);
  const result = await browseMediaFolder(ROOT, url.searchParams.get("path"), { q: url.searchParams.get("q") });
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ...result, browsable: true });
}
