import "server-only";
import { db } from "@elkdonis/db";
import { isAdmin } from "@elkdonis/auth-server";
import {
  FORUM_ANONYMOUS,
  getIdentityIds,
  getViewerRoles,
  listBoards,
  listTopics,
  type ForumViewer,
  type ForumTopicRow,
} from "@elkdonis/services";
import type { SurfaceForum, SurfaceForumFeed, SurfaceForumThread } from "@elkdonis/cms-ui/surface";
import { getCurrentUser } from "@/lib/session";
import { getCrossOrgForum, type CrossOrgForumItem } from "@/lib/org-forum";

/**
 * The org forum for the hub's Organization page: the SELECTED org's board, read as the signed-in viewer.
 *
 * Sunjay's `getForumSnapshot` (apps/sunjay/src/lib/forum.ts) is the model, with two differences that come from
 * this app being multi-org: the org is a parameter (the page's `?org=<slug>`), not a `siteConfig` constant; and
 * `@elkdonis/forum-ui` is not a dependency of this app, so the snapshot mapping (forum-ui/src/snapshot.ts) is
 * done here over the same `listBoards` / `listTopics` services. Every visibility rule stays in the services
 * (`visibleTo`); nothing here decides who may read what.
 *
 * The viewer always comes from the SESSION. No route takes a user from its params.
 */

export type HubForumOrg = { id: string; slug: string; name: string };

/** The forum viewer for this request's session, or the anonymous one. */
export async function getHubForumViewer(): Promise<ForumViewer> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return FORUM_ANONYMOUS;
  const [roles, identityIds, admin] = await Promise.all([
    getViewerRoles(user.id),
    // Their own row plus any pen names, so "my topics" keeps working whichever name signed them.
    getIdentityIds(user.id).catch(() => [user.id]),
    isAdmin(user.id).catch(() => false),
  ]);
  return { userId: user.id, roles, identityIds, isGlobalAdmin: admin };
}

export async function getHubForumOrg(slug: string): Promise<HubForumOrg | null> {
  if (!slug) return null;
  const rows = await db<HubForumOrg[]>`SELECT id, slug, name FROM organizations WHERE slug = ${slug} LIMIT 1`.catch(
    () => [] as HubForumOrg[]
  );
  return rows[0] ?? null;
}

/** Where a forum link goes. There is no forum page on this host: the forum lives in the surface, on the page. */
export const hubForumHref = (orgSlug: string) => `/hub/organization?org=${encodeURIComponent(orgSlug)}`;

const toThread = (r: ForumTopicRow, orgSlug: string): SurfaceForumThread => ({
  id: r.id,
  title: r.title,
  kind: r.kind,
  feedName: r.feed.name ?? null,
  authorName: r.author.name,
  replyCount: r.replyCount,
  at: new Date(r.lastActivityAt).toISOString(),
  unread: r.unread,
  href: hubForumHref(orgSlug),
});

/**
 * This org's forum as one snapshot: the face and the popup it opens read the same call, so they agree. Null when
 * the org has no board the viewer can see. Counts are per viewer, because visibility is.
 */
export async function hubForumSnapshot(org: HubForumOrg, viewer: ForumViewer): Promise<SurfaceForum | null> {
  const scope = { kind: "org", orgId: org.id } as const;
  const href = hubForumHref(org.slug);

  const [boards, recentPage, unreadPage] = await Promise.all([
    listBoards(scope, viewer),
    listTopics(scope, viewer, { sort: "active", limit: 6 }),
    viewer.userId ? listTopics({ kind: "unread", scope }, viewer, { limit: 1 }) : Promise.resolve(null),
  ]);
  const board = boards[0];
  if (!board) return null;

  // The auto-created `general` feed is only shown once it holds something (migrations 110/113).
  const feeds: SurfaceForumFeed[] = board.feeds
    .filter((f) => !(f.slug === "general" && f.topicCount === 0))
    .map((f) => ({
      slug: f.slug,
      name: f.name,
      topicCount: f.topicCount,
      unreadCount: f.unreadCount,
      accent: f.accent,
      href,
      parentSlug: f.parentSlug,
      closed: Boolean(f.minRole),
    }));

  return {
    title: "Forum",
    href,
    feeds: feeds.slice(0, 30),
    recent: recentPage.rows.map((r) => toThread(r, org.slug)),
    topicCount: board.feeds.reduce((n, f) => n + f.topicCount, 0),
    postCount: board.feeds.reduce((n, f) => n + f.postCount, 0),
    unreadCount: unreadPage ? unreadPage.total : null,
    unreadHref: null,
    // Starting a topic is still on the org's own forum page; this card reads and replies.
    composeHref: null,
  };
}

/** The topics in one section, newest activity first (what the section layer lists). */
export async function hubForumFeed(org: HubForumOrg, viewer: ForumViewer, feedSlug: string): Promise<SurfaceForumThread[]> {
  const page = await listTopics({ kind: "feed", orgId: org.id, feedSlug }, viewer, { sort: "active", limit: 30 });
  return page.rows.map((r) => toThread(r, org.slug));
}

export type HubAcrossItem = CrossOrgForumItem;

/**
 * The old cross-org board's data (org-forum.ts), for "Across your organisations": the latest threads in every
 * org the viewer holds a role in. Empty when signed out. Rows open in the thread frame, so the thread route's
 * `visibleTo` check is the gate for each one.
 */
export async function hubAcrossOrgs(viewer: ForumViewer, limit = 20): Promise<HubAcrossItem[]> {
  if (!viewer.userId) return [];
  return getCrossOrgForum(Object.keys(viewer.roles), limit);
}

/**
 * The server loader for the Organization page: the selected org's forum for the signed-in viewer, ready to hand
 * to <OrgForumFace forum={...} />. Never throws (a failed read draws the face's "not set up" state).
 */
export async function loadOrgForumFace(org: HubForumOrg): Promise<SurfaceForum | null> {
  try {
    return await hubForumSnapshot(org, await getHubForumViewer());
  } catch (err) {
    console.error("[hub-forum] loadOrgForumFace:", err);
    return null;
  }
}
