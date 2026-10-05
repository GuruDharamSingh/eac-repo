import { type NextRequest } from "next/server";
import { serveMedia } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { paathFileAllowed } from "@/lib/paath";

/**
 * A reading circle's private files (Private/Circles/…) for anyone with a role
 * in this org, viewers included — the rule the owner set for circles
 * (2026-09-26). The shared canReadMedia admits members only, so this route
 * decides access itself and passes `preAuthorized`, with the prefix pinned to
 * the circles folder. Everything else under Private/ still goes through
 * /api/media and its member rule.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const filePath = path.join("/");
  const prefix = `EAC_Network/${siteConfig.orgId}/Private/Circles/`;
  const viewer = await getViewer().catch(() => null);
  const inCircles = filePath.startsWith(prefix) && !filePath.includes("..");
  // A private circle (the Akhand Path) admits only its own readers, not the whole org.
  const privateGate = inCircles ? await paathFileAllowed(filePath.slice(`EAC_Network/${siteConfig.orgId}/`.length), viewer) : null;
  const allowed = inCircles && (privateGate ?? Boolean(viewer?.isAffiliate));

  // 404 for "not allowed" too, like /api/media: a miss must not confirm a path exists.
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }
  return serveMedia({
    filePath,
    viewerId: viewer?.userId ?? null,
    allowedPrefixes: [prefix],
    range: request.headers.get("range"),
    preAuthorized: true,
  });
}
