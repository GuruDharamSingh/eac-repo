import { type NextRequest } from "next/server";
import { serveMedia } from "@elkdonis/services";
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
    range: request.headers.get("range"),
  });
}
