import { type NextRequest } from "next/server";
import { parseThumbnailWidth, serveMedia } from "@elkdonis/services";
import { getServerSession } from "@elkdonis/auth-server";

/**
 * Media proxy — the shared serveMedia factory, not a hand-rolled copy (there
 * are already fifteen of those). Nextcloud credentials stay server-side; the
 * browser only ever sees this URL.
 *
 * Serves the whole network tree (2026-11-11, developer): this org's covers
 * uploaded through arts-collective land in its slug folder
 * (`4th-way-book-readers/`), and every public file is already served by
 * arts-collective.com. canReadMedia inside serveMedia still decides each
 * `Private/` path; the Akhand Path files go through `circle-file`, not here.
 * `docs/open/MEDIA_OWNERSHIP_AND_PLACEMENT_2026-11-11.md`. `?w=` is passed through: the shelf shows
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
    allowedPrefixes: ["EAC_Network/"],
    range: request.headers.get("range"),
    width: parseThumbnailWidth(request.nextUrl.searchParams.get("w")),
  });
}
