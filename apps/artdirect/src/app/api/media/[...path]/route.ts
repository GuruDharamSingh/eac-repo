import { type NextRequest } from "next/server";
import { parseThumbnailWidth, serveMedia } from "@elkdonis/services";
import { getServerSession } from "@elkdonis/auth-server";

/**
 * Media proxy.
 *
 * Serving is `serveMedia` in @elkdonis/services; what stays here is resolving
 * who is asking.
 *
 * Serves the whole network tree (2026-11-11, developer). A person's page shows
 * pieces whose pictures were filed under whichever org the Studio was acting
 * for (`ifac/`, `hidden-enneagram/`, slug-named folders), and those returned
 * 404 here under the old `artdirect/` + `users/` + `oad/` bound. Every public
 * file is already served by arts-collective.com, so the bound protected
 * nothing public; `canReadMedia` inside serveMedia still decides each
 * `Private/` and workshop path.
 * `docs/open/MEDIA_OWNERSHIP_AND_PLACEMENT_2026-11-11.md`.
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
