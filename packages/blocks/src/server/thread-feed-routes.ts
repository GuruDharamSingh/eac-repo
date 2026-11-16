import { loadThreadFeed } from "./thread-feed.server";

/**
 * GET handler for a thread-feed block's editor rows. The same handler was
 * copied into danamccool, hidden-enneagram and katie-the-potter.
 *
 * Deliberately ungated: `loadThreadFeed` filters to the org's PUBLISHED, PUBLIC
 * threads itself, so this returns only what any visitor already sees. A
 * caller-supplied `orgId` is never read: the editor runs on one org's site.
 */
export function threadFeedRoutes(opts: { orgId: () => string }) {
  async function GET(request: Request) {
    const url = new URL(request.url);
    const raw = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 50) : 10;
    const items = await loadThreadFeed(opts.orgId(), { limit, upcomingOnly: true });
    return Response.json({ items });
  }
  return { GET };
}
