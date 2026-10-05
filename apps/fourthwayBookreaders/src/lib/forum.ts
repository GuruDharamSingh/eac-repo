import { FORUM_ANONYMOUS, getIdentityIds, getViewerRoles, type ForumViewer } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";

/** The forum viewer for this site's session (roles across orgs, pen names), or the anonymous one. */
export async function getForumViewer(): Promise<ForumViewer> {
  const v = await getViewer();
  if (!v) return FORUM_ANONYMOUS;
  const [roles, identityIds] = await Promise.all([
    getViewerRoles(v.userId),
    getIdentityIds(v.userId).catch(() => [v.userId]),
  ]);
  return { userId: v.userId, roles, identityIds };
}
