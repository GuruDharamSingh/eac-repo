import { type NextRequest } from "next/server";
import { serveMedia, parseThumbnailWidth } from "@elkdonis/services";
import { getServerSession } from "@elkdonis/auth-server";

/**
 * Media proxy for the storefront.
 *
 * The serving — prefix check, viewer authorization, range passthrough, the
 * cache rule for private bytes, and the downscaled `?w=` variants — is
 * `serveMedia` in @elkdonis/services, the same helper arts-collective uses.
 * What stays here is resolving WHO is asking, which every app does differently.
 *
 * Artwork images are public paths (`EAC_Network/users/<slug>/Media/...`), so
 * they still serve anonymously; what this gained over the hand-rolled proxy it
 * replaces is `?w=`, without which the 3D gallery pulls a dozen multi-megabyte
 * masters to fill a wall of pictures barely a thousand pixels across.
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
