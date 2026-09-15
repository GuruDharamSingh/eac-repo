import { toSurfaceThread as sharedToSurfaceThread } from "@elkdonis/cms-ui/surface";
import type { Thread } from "@/lib/types";

/**
 * This site's `Thread` view-model → the shared `SurfaceThread`.
 *
 * The mapping itself is `@elkdonis/cms-ui/surface`'s `toSurfaceThread` — see
 * the note in amrit-canada's copy of this file for why. This site publishes
 * writing and offerings, not gatherings: its own `Thread` type carries no
 * scheduling, recurrence or RSVP columns at all, so every one of those
 * fields is simply omitted below rather than nulled out one by one — the
 * shared mapper treats an omitted optional field as null, which is what
 * makes the surface hide those sections instead of rendering empty ones.
 */
export function toSurfaceThread(
  thread: Thread,
  extras: { feed?: { slug: string; name: string } | null } = {}
) {
  return sharedToSurfaceThread(
    {
      id: thread.id,
      title: thread.title,
      slug: thread.slug,
      kind: thread.kind,
      status: thread.status,
      visibility: thread.visibility,
      excerpt: thread.excerpt,
      bodyHtml: thread.description,
      coverImageUrl: thread.coverImageUrl,
      authorName: thread.authorName,
      authorPhoto: thread.authorPhoto,
      publishedAt: thread.publishedAt,
      // Threads live under their feed on this site: /{section}/{slug}.
      href: thread.feedSlug ? `/${thread.feedSlug}/${thread.slug}` : null,
    },
    { feed: extras.feed }
  );
}
