import { getForumFeedThreads, getForumSnapshot } from "@/lib/forum";

/**
 * This org's forum in one object, for the hub's forum surface.
 *
 * The tile is drawn server-side in hub/page.tsx from the same call; this
 * exists so the popup can walk into a section, and refresh itself after
 * "Mark all read", without a page load.
 *
 * Deliberately NOT behind the member gate: the snapshot is already per viewer
 * (`getForumViewer` resolves to the anonymous one when signed out) and the
 * board is partly public, so gating it would make the popup emptier than the
 * page it mirrors.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const feed = new URL(request.url).searchParams.get("feed");
  if (feed) {
    return Response.json({ threads: await getForumFeedThreads(feed) });
  }
  // The snapshot UNWRAPPED. `connectors.forum.load()` returns the whole body
  // as the forum, so wrapping it in `{ forum: … }` hands the surface an object
  // with no `feeds` and no `recent` — and it reads `.length` off both, which
  // took the entire hub to the error boundary.
  return Response.json(await getForumSnapshot());
}
