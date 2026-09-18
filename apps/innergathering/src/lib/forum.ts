import { cookies } from "next/headers";
import {
  forumFeedThreads,
  forumSnapshot,
  orgHrefs,
  serviceConnectors,
  type ForumConnectors,
} from "@elkdonis/forum-ui";
import { getViewerRoles, getIdentityIds, FORUM_ANONYMOUS } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * The Grand Forum, scoped to this org, at /forum. The same package every other
 * org site mounts; this file is the whole difference between them.
 */

/** One definition of where the forum's links go — the board and the hub tile. */
export const forumHrefs = orgHrefs({ base: "/forum", signIn: "/login?next=/forum" });

/** The forum viewer for this site's session, or the anonymous one. */
export async function getForumViewer() {
  const v = await getViewer();
  if (!v) return FORUM_ANONYMOUS;
  const [roles, identityIds] = await Promise.all([
    getViewerRoles(v.userId),
    // Their own row plus any pen names, so "your own threads" keeps working
    // whichever name signed them.
    getIdentityIds(v.userId).catch(() => [v.userId]),
  ]);
  return { userId: v.userId, roles, identityIds };
}

export async function getForumConnectors(): Promise<ForumConnectors> {
  const jar = await cookies();
  const pref = jar.get("forum_theme")?.value;
  const theme = pref === "classic" ? "classic" : "modern";
  // Light by default here, unlike IFAC: this site's whole chrome is navy on
  // parchment, and a dark board would read as somebody else's page. A reader
  // who prefers the dark ground gets it from the toggle, and we remember it.
  const m = jar.get("forum_mode")?.value;
  const mode = m === "dark" || m === "auto" ? m : "light";
  return serviceConnectors({
    scope: { kind: "org", orgId: siteConfig.orgId },
    siteName: siteConfig.orgName,
    viewer: getForumViewer,
    hrefs: forumHrefs,
    actionBase: "/api/forum",
    theme,
    mode,
  });
}

/** This org's forum as one snapshot, for the hub tile. */
export async function getForumSnapshot() {
  return forumSnapshot({
    scope: { kind: "org", orgId: siteConfig.orgId },
    viewer: await getForumViewer(),
    hrefs: forumHrefs,
    title: "Forum",
  });
}

/** One section's threads, for the forum popup's section view. */
export async function getForumFeedThreads(feedSlug: string) {
  return forumFeedThreads({
    scope: { kind: "org", orgId: siteConfig.orgId },
    viewer: await getForumViewer(),
    hrefs: forumHrefs,
    feedSlug,
  });
}
