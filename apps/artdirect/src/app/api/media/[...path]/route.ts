import { type NextRequest } from "next/server";
import { serveMedia } from "@elkdonis/services";
import { getServerSession } from "@elkdonis/auth-server";

/**
 * Media proxy.
 *
 * Serving is `serveMedia` in @elkdonis/services; what stays here is resolving
 * who is asking, and which prefixes this app will serve at all.
 *
 * The prefix list is the important local part: this is a directory app, so it
 * serves its own org tree and the per-person tree, and nothing else. Without
 * it the service account would make this route a reader for every org's files.
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
    allowedPrefixes: ["EAC_Network/artdirect/", "EAC_Network/users/"],
    range: request.headers.get("range"),
  });
}
