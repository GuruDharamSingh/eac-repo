import { type NextRequest } from "next/server";
import { parseThumbnailWidth, serveMedia } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";

/**
 * Serves files out of Nextcloud.
 *
 * This was a hand-rolled proxy — one of about fourteen, each of which got a
 * different subset of the same problem right. It is now `serveMedia` from
 * @elkdonis/services, which is the same behaviour written once: the viewer
 * check, range passthrough, `nosniff`, inline-vs-attachment (an uploaded SVG
 * is a script container and must not render from this origin), the cache rule
 * for private bytes, and downscaled `?w=` variants.
 *
 * Two things that changed by moving:
 *
 *   1. Privacy is decided by the same parser authorization uses. The old
 *      `filePath.includes("/Private/")` test was case-SENSITIVE while the
 *      authorization test is not, so a folder named `private/` was gated
 *      correctly and then marked publicly cacheable for a year.
 *   2. An anonymous request now gets 404 rather than 401. A proxy that
 *      answers differently for "no such file" and "not yours" tells a
 *      stranger which paths exist.
 *
 * What stays here is resolving WHO is asking, because every app does that
 * differently and it is the one input a shared helper must not guess.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const viewer = await getViewer();

  return serveMedia({
    filePath: path.join("/"),
    viewerId: viewer?.userId ?? null,
    // The whole network tree (2026-11-11, developer). An org-scoped bound
    // returned 404 for this org's own covers filed under its slug folder
    // (`inner-gathering/`, the `astrology-reading` service) and for anything a
    // page shows from another owner. Every public file is already served by
    // arts-collective.com; the access decision for `Private/` and workshop
    // paths is canReadMedia inside serveMedia.
    // docs/open/MEDIA_OWNERSHIP_AND_PLACEMENT_2026-11-11.md
    allowedPrefixes: ["EAC_Network/"],
    range: request.headers.get("range"),
    width: parseThumbnailWidth(request.nextUrl.searchParams.get("w")),
  });
}
