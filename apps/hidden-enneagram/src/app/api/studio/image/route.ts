import { type NextRequest } from "next/server";
import { convertMediaImage } from "@elkdonis/services";
import { getServerSession } from "@elkdonis/auth-server";

/**
 * A stored picture at a working size and format, for the Studio's image
 * editor and the Post kind's "Make JPEG": `?path=EAC_Network/…&max=2048&format=jpeg`.
 * Signed-in only; the viewer must be able to read the file (media-convert.ts).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  const q = request.nextUrl.searchParams;
  return convertMediaImage({
    filePath: q.get("path") ?? "",
    viewerId: session.user?.db_user_id ?? session.user?.id ?? null,
    max: q.get("max"),
    format: q.get("format"),
    allowedPrefixes: ["EAC_Network/"],
  });
}
