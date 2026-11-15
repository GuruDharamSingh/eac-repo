import { getApiEditor } from "@/lib/auth";
import { loadHubChannel } from "@/lib/hub-channel";

/**
 * The hub Channel card's data, for its pop-up (2026-11-15). Same gate as /channel: signed in and an owner or
 * guide of this site's org (getApiEditor); the org is always siteConfig.orgId, never a parameter. GET only; reads
 * never cache. Writes do not come here: the pop-up runs them through the Channel door (lib/channel-door.ts).
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const viewer = await getApiEditor();
  if (!viewer) return Response.json({ error: "Owners and guides only" }, { status: 403, headers: NO_STORE });
  try {
    return Response.json(await loadHubChannel(viewer), { headers: NO_STORE });
  } catch (err) {
    console.error("[api/hub/channel]", err);
    return Response.json({ error: "Channel could not be read" }, { status: 500, headers: NO_STORE });
  }
}
