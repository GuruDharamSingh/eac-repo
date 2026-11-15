import { type NextRequest } from "next/server";
import { parseThumbnailWidth, serveMedia } from "@elkdonis/services";
import { getServerSession } from "@elkdonis/auth-server";

/**
 * Media proxy, matching IFAC's api/media/[...path]/route.ts. Serves the whole
 * network tree (2026-11-11, developer): her pages can show files filed under
 * other owners, and every public file is already served by arts-collective.com.
 * `canReadMedia` inside serveMedia still decides each `Private/` and workshop
 * path. `docs/open/MEDIA_OWNERSHIP_AND_PLACEMENT_2026-11-11.md`.
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
    // `?w=` asks for a downscaled variant. Her masters run to 22MB (the
    // butterflies detail); a gallery tile has no use for that.
    width: parseThumbnailWidth(request.nextUrl.searchParams.get("w")),
  });
}
