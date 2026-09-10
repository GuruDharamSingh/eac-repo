import type { ForumScope, ForumViewer } from "@elkdonis/services";
import type { SurfaceForum, SurfaceForumFeed, SurfaceForumThread } from "@elkdonis/cms-ui/surface";
import type { ForumHrefs } from "./connectors";

// ============================================================================
// The forum as one snapshot, for the surface system.
//
// `@elkdonis/cms-ui/surface` declares the shape (SurfaceForum) and draws it;
// it never imports the data layer, which is what lets a host with different
// storage fill in the same tile. This is the mapping for everything already
// on `threads` — so an org site gets a live forum tile in one call:
//
//   const forum = await forumSnapshot({ scope, viewer, hrefs, title });
//
// Sections are the org's feeds on an org host, and the orgs themselves on the
// network host — the level a person actually picks between in each place.
// Every count is per viewer, because visibility is.
// ============================================================================

export interface ForumSnapshotOptions {
  scope: ForumScope;
  viewer: ForumViewer;
  hrefs: ForumHrefs;
  /** Names the board on the tile — the org's name, or the forum's. */
  title: string;
  /** Newest threads to carry. The surface shows what fits. */
  recentLimit?: number;
  /** Sections to carry. */
  feedLimit?: number;
}

export async function forumSnapshot(opts: ForumSnapshotOptions): Promise<SurfaceForum | null> {
  const { scope, viewer, hrefs, title } = opts;
  const s = await import("@elkdonis/services");
  const root = hrefs.root().replace(/\/$/, "");

  const [boards, recentPage, unreadPage] = await Promise.all([
    s.listBoards(scope, viewer),
    s.listTopics(
      scope.kind === "org" ? { kind: "org", orgId: scope.orgId } : { kind: "network" },
      viewer,
      { sort: "active", limit: opts.recentLimit ?? 6 }
    ),
    viewer.userId
      ? s.listTopics({ kind: "unread", scope }, viewer, { limit: 1 })
      : Promise.resolve(null),
  ]);

  if (boards.length === 0) return null;

  // On an org host the sections are that org's feeds; on the network host the
  // orgs are the sections, because a feed of another org is one level too deep
  // for a tile. The auto-created `general` feed is only shown once it holds
  // something (migrations 110/113).
  const feeds: SurfaceForumFeed[] =
    scope.kind === "org"
      ? boards[0].feeds
          .filter((f) => !(f.slug === "general" && f.topicCount === 0))
          .map((f) => ({
            slug: f.slug,
            name: f.name,
            topicCount: f.topicCount,
            unreadCount: f.unreadCount,
            accent: f.accent,
            href: hrefs.feed(boards[0].slug, f.slug),
          }))
      : boards
          .filter((b) => b.feeds.some((f) => f.topicCount > 0))
          .map((b) => ({
            slug: b.slug,
            name: b.name,
            topicCount: b.feeds.reduce((n, f) => n + f.topicCount, 0),
            unreadCount: b.feeds.reduce<number | null>(
              (n, f) => (f.unreadCount == null ? n : (n ?? 0) + f.unreadCount),
              null
            ),
            accent: null,
            href: hrefs.board(b.slug),
          }));

  const counted = scope.kind === "org" ? boards[0].feeds : boards.flatMap((b) => b.feeds);
  const topicCount = counted.reduce((n, f) => n + f.topicCount, 0);
  const postCount = counted.reduce((n, f) => n + f.postCount, 0);

  const recent: SurfaceForumThread[] = recentPage.rows.map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    feedName: r.feed.name ?? (scope.kind === "network" ? r.org.name : null),
    authorName: r.author.name,
    replyCount: r.replyCount,
    at: new Date(r.lastActivityAt).toISOString(),
    unread: r.unread,
    href: hrefs.thread(r.id, r.slug),
  }));

  // Composing happens in the inline form at the foot of a section, so the
  // action points at one — the first with anything in it, else the first.
  const composeFeed = scope.kind === "org" ? (feeds.find((f) => f.topicCount > 0) ?? feeds[0]) : null;

  return {
    title,
    href: hrefs.root(),
    feeds: feeds.slice(0, opts.feedLimit ?? 8),
    recent,
    topicCount,
    postCount,
    unreadCount: unreadPage ? unreadPage.total : null,
    unreadHref: viewer.userId ? `${root}/unread` : null,
    composeHref: composeFeed && viewer.userId ? `${composeFeed.href}#newtopic` : null,
  };
}
