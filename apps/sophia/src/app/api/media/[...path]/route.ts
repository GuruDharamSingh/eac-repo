import { type NextRequest } from "next/server";
import { parseThumbnailWidth, serveMedia } from "@elkdonis/services";
import { getViewer } from "@/lib/viewer";

/**
 * Media proxy on the shared read path (services' serveMedia): authorised per
 * file by canReadMedia, ranged for audio/video seeking, `?w=` for a downscaled
 * image. Courses belong to any org, so no prefix list — the authorisation is
 * the gate. Public course media lives under EAC_Network/<org>/Media/.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const viewer = await getViewer();
  return serveMedia({
    filePath: path.join("/"),
    viewerId: viewer.userId,
    range: request.headers.get("range"),
    width: parseThumbnailWidth(request.nextUrl.searchParams.get("w")),
  });
}
