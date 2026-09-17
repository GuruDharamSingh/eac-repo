import { type NextRequest } from "next/server";
import { serveMedia, parseThumbnailWidth } from "@elkdonis/services";
import { getServerSession } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";

/**
 * Media proxy.
 *
 * Serving is `serveMedia` in @elkdonis/services; what stays here is resolving
 * who is asking, and which prefixes this app will serve at all.
 *
 * This container serves one org, so the prefix list is that org's tree plus
 * the per-person tree — the members' own folders, which is where an artist's
 * uploads live.
 *
 * `?w=` asks for a resized variant (sharp, cached in Redis, snapped to a fixed
 * ladder of widths so the cache cannot be filled with arbitrary sizes). This
 * route ignored the parameter until now, which meant every grid of thumbnails
 * on this site pulled full-size masters — a 750KB original behind a 96px tile.
 * `parseThumbnailWidth` returns null for anything it does not recognise, and
 * a null width serves the original, so an unreadable value degrades to
 * today's behaviour rather than failing.
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
    width: parseThumbnailWidth(request.nextUrl.searchParams.get("w")),
    range: request.headers.get("range"),
  });
}
