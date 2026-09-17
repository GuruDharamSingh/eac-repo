import { forumSnapshot, orgHrefs, serviceConnectors, type ForumConnectors } from "@elkdonis/forum-ui";
import { getViewerRoles, getIdentityIds, FORUM_ANONYMOUS } from "@elkdonis/services";
import { cookies } from "next/headers";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * The Grand Forum, scoped to this org, at /forum. Same package the network
 * host and every other org site mounts; this file is the whole difference.
 */

/** One definition of where the forum's links go, for the board and the tile. */
export const forumHrefs = orgHrefs({ base: "/forum", signIn: "/login?next=/forum" });

/** The forum viewer for this site's session, or the anonymous one. */
export async function getForumViewer() {
  const v = await getViewer();
  if (!v) return FORUM_ANONYMOUS;
  const [roles, identityIds] = await Promise.all([
    getViewerRoles(v.userId),
    // Their own row plus any pen names, so `author_id = viewer` keeps
    // showing someone their own threads whichever name signed them.
    getIdentityIds(v.userId).catch(() => [v.userId]),
  ]);
  return { userId: v.userId, roles, identityIds };
}

export async function getForumConnectors(): Promise<ForumConnectors> {
  const jar = await cookies();
  const pref = jar.get("forum_theme")?.value;
  const theme = pref === "classic" || pref === "modern" ? pref : "classic";
  return serviceConnectors({
    scope: { kind: "org", orgId: siteConfig.orgId },
    siteName: siteConfig.orgName,
    viewer: getForumViewer,
    hrefs: forumHrefs,
    actionBase: "/api/forum",
    theme,
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
