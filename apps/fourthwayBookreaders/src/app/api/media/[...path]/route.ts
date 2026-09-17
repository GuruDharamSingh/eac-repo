import { type NextRequest } from "next/server";
import { parseThumbnailWidth, serveMedia } from "@elkdonis/services";
import { getServerSession } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";

/**
 * Media proxy — the shared serveMedia factory, not a hand-rolled copy (there
 * are already fifteen of those). Nextcloud credentials stay server-side; the
 * browser only ever sees this URL.
 *
 * Scoped to this org's tree plus the per-person tree, so this proxy cannot be
 * used to read another org's files. `?w=` is passed through: the shelf shows
 * a dozen covers at 108px, and serving 3MB masters for those is the exact
 * waste the thumbnail variants exist to stop.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const session = await getServerSession();

  return serveMedia({
    filePath: path.join("/"),
    viewerId: session.user?.db_user_id ?? session.user?.id ?? null,
    allowedPrefixes: [`EAC_Network/${siteConfig.orgId}/`, "EAC_Network/users/"],
    range: request.headers.get("range"),
    width: parseThumbnailWidth(request.nextUrl.searchParams.get("w")),
  });
}
