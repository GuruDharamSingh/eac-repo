import { getForumSnapshot } from "@/lib/forum";

/**
 * This org's forum in one object, for the hub's forum surface.
 *
 * The tile is drawn server-side in hub/page.tsx from the same call; this
 * exists so the popup can refresh itself after "Mark all read" without a
 * page load. Counts are per viewer — a signed-out reader sees the public
 * board's numbers, a member sees theirs.
 *
 * Deliberately NOT behind getHubViewer: the snapshot is already per-viewer
 * (getForumViewer resolves to the anonymous viewer when signed out) and the
 * forum itself is partly public, so gating this on membership would make the
 * popup emptier than the board it mirrors.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getForumSnapshot());
}
