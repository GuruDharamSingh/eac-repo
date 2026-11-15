import { type NextRequest } from "next/server";
import { serveMedia, parseThumbnailWidth } from "@elkdonis/services";
import { getServerSession } from "@elkdonis/auth-server";

/**
 * Media proxy.
 *
 * Serving is `serveMedia` in @elkdonis/services; what stays here is resolving
 * who is asking.
 *
 * Serves the whole network tree (2026-11-11, developer). A page here shows
 * files from many owners: an artist's own folder (`users/`), her personal
 * site's org (Dana's `danamccool`), ArtDirect imports (`artdirect/`), a piece
 * made under another org. An org-scoped bound returned 404 for those (Jason
 * Ford's artworks under `artdirect/`). Every public file is already served by
 * arts-collective.com, so the bound protected nothing public; `canReadMedia`
 * inside serveMedia still decides each `Private/` and workshop path.
 * `docs/open/MEDIA_OWNERSHIP_AND_PLACEMENT_2026-11-11.md`.
 *
 * `?w=` asks for a resized variant (sharp, cached in Redis, snapped to a fixed
 * ladder of widths so the cache cannot be filled with arbitrary sizes).
 * `parseThumbnailWidth` returns null for anything it does not recognise, and
 * a null width serves the original.
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
    width: parseThumbnailWidth(request.nextUrl.searchParams.get("w")),
    range: request.headers.get("range"),
  });
}
