import { forumSnapshot, orgHrefs, serviceConnectors, type ForumConnectors } from "@elkdonis/forum-ui";
import { getViewerRoles, FORUM_ANONYMOUS } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * The Grand Forum, scoped to this org, at /forum. Same package as the
 * network host; this file is the whole difference.
 */
const ARTDIRECT_URL = (process.env.ARTDIRECT_URL ?? process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");

/** One definition of where the forum's links go, for the board and the tile. */
export const forumHrefs = orgHrefs({ base: "/forum", signIn: "/login?next=/forum" });

/** The forum viewer for this site's session, or the anonymous one. */
export async function getForumViewer() {
  const v = await getViewer();
  return v ? { userId: v.userId, roles: await getViewerRoles(v.userId) } : FORUM_ANONYMOUS;
}

export function getForumConnectors(): Promise<ForumConnectors> {
  return serviceConnectors({
    scope: { kind: "org", orgId: siteConfig.orgId },
    siteName: siteConfig.orgName,
    viewer: getForumViewer,
    hrefs: forumHrefs,
    actionBase: "/api/forum",
  });
}

/**
 * This org's forum as one snapshot — the hub tile and the popup it opens read
 * the same call, so they always agree. The title is just "Forum": the org's
 * name is already the site you are standing on.
 */
export async function getForumSnapshot() {
  return forumSnapshot({
    scope: { kind: "org", orgId: siteConfig.orgId },
    viewer: await getForumViewer(),
    hrefs: forumHrefs,
    title: "Forum",
  });
}

export const forumProfileUrl = (slug: string | null) => (slug && ARTDIRECT_URL ? `${ARTDIRECT_URL}/${slug}` : null);
