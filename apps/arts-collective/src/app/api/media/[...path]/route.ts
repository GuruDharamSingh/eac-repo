import { type NextRequest } from "next/server";
import { serveMedia, parseThumbnailWidth } from "@elkdonis/services";
import { getServerSession } from "@elkdonis/auth-server";

/**
 * Media proxy.
 *
 * The serving — prefix check, viewer authorization, range passthrough, the
 * cache rule for private bytes, `nosniff`, and inline-vs-attachment — is
 * `serveMedia` in @elkdonis/services. What stays here is resolving WHO is
 * asking, because every app does that differently and it is the one input a
 * shared helper must not guess.
 *
 * This route reaches the whole network tree with the shared service account,
 * which is why the authorization is not optional: before `canReadMedia`, an
 * anonymous request for any org's `Private/` path was served.
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
