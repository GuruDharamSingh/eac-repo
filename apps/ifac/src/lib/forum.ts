import { forumSnapshot, orgHrefs, serviceConnectors, type ForumConnectors } from "@elkdonis/forum-ui";
import { getViewerRoles, FORUM_ANONYMOUS } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { cookies } from "next/headers";

/**
 * The Grand Forum, scoped to this org, at /forum. Same package the network
 * host and every other org site mounts; this file is the whole difference.
 *
 * IFAC keeps its own hub tiles (HubCard + native <dialog>), which predate the
 * shared surface system, so this app takes the board and the tile FACE but
 * not the popup — the tile navigates to /forum instead of opening a surface.
 * Nothing here depends on that choice; mounting SurfaceProvider later would
 * turn the face into a popup without touching this file.
 */

/** One definition of where the forum's links go, for the board and the tile. */
export const forumHrefs = orgHrefs({ base: "/forum", signIn: "/login?redirect=/forum" });

/** The forum viewer for this site's session, or the anonymous one. */
export async function getForumViewer() {
  const v = await getViewer();
  return v ? { userId: v.userId, roles: await getViewerRoles(v.userId) } : FORUM_ANONYMOUS;
}

export async function getForumConnectors(): Promise<ForumConnectors> {
  const jar = await cookies();
  const pref = jar.get("forum_theme")?.value;
  const theme = pref === "classic" ? "classic" : "modern";
  // Dark by default — the brushed-silver ground, which also sits better with
  // IFAC's own near-black chrome than paper did. A reader who prefers paper
  // gets it from the toggle in the footer and we remember that, so only an
  // explicit "light"/"auto" cookie overrides the default.
  const m = jar.get("forum_mode")?.value;
  const mode = m === "light" || m === "auto" ? m : "dark";
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
