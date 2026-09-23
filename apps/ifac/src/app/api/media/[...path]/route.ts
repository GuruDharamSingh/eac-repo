import { type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
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
/**
 * The folders of orgs that IFAC's own members OWN — an artist's personal site
 * (Dana's `danamccool`) is where much of her work is filed, and her IFAC
 * profile and galleries point at it. IFAC serves a member's work from wherever
 * it lives in Nextcloud: their own folder (`users/`) or an org that is theirs.
 * Not every org on the network — only ones an IFAC-listed person owns.
 *
 * Read access is still decided per file by serveMedia's canReadMedia (Private
 * folders, workshop materials…); this list only scopes what this site will
 * serve at all. Cached for a minute: it runs on every image request.
 */
let memberOrgs: { at: number; prefixes: string[] } | null = null;
async function memberOrgPrefixes(): Promise<string[]> {
  if (memberOrgs && Date.now() - memberOrgs.at < 60_000) return memberOrgs.prefixes;
  try {
    const rows = await db<Array<{ org_id: string }>>`
      SELECT DISTINCT uo.org_id
      FROM org_profiles p
      JOIN user_organizations uo ON uo.user_id = p.user_id AND uo.role = 'owner'
      WHERE p.org_id = ${siteConfig.orgId} AND p.is_public
    `;
    const prefixes = rows.map((r) => `EAC_Network/${r.org_id}/`).filter((p) => /^EAC_Network\/[a-z0-9_-]+\/$/.test(p));
    memberOrgs = { at: Date.now(), prefixes };
    return prefixes;
  } catch (err) {
    console.error("[ifac] memberOrgPrefixes:", err);
    return memberOrgs?.prefixes ?? [];
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const session = await getServerSession();

  return serveMedia({
    filePath: path.join("/"),
    viewerId: session.user?.db_user_id ?? session.user?.id ?? null,
    allowedPrefixes: [`EAC_Network/${siteConfig.orgId}/`, "EAC_Network/users/", ...(await memberOrgPrefixes())],
    width: parseThumbnailWidth(request.nextUrl.searchParams.get("w")),
    range: request.headers.get("range"),
  });
}
