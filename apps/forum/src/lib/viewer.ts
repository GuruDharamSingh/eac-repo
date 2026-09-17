import { getServerSession, isAdmin } from "@elkdonis/auth-server";
import { getViewerRoles, getProfile, touchLastSeen, getIdentityIds, FORUM_ANONYMOUS, type ForumViewer } from "@elkdonis/services";

export interface HostViewer extends ForumViewer {
  name: string | null;
}

/**
 * The current viewer, never throwing: the forum renders for everyone and
 * decides per row what they may see.
 *
 * FORUM_DEV_VIEWER_ID (never in production) impersonates a database user so
 * the board can be exercised on a host without the auth service — the dev
 * server on this box has no GoTrue to talk to.
 */
export async function getViewer(): Promise<HostViewer> {
  try {
    const devId = process.env.NODE_ENV !== "production" ? process.env.FORUM_DEV_VIEWER_ID : undefined;
    let userId: string | null = null;
    let email: string | null = null;
    if (devId) {
      userId = devId;
    } else {
      const session = await getServerSession();
      if (!session.user) return { ...FORUM_ANONYMOUS, name: null };
      userId = session.user.db_user_id ?? session.user.id;
      email = session.user.email;
    }
    const [roles, admin, profile, identityIds] = await Promise.all([
      getViewerRoles(userId),
      isAdmin(userId),
      getProfile(userId).catch(() => null),
      // Their own row plus any pen names, so the board keeps showing them
      // their own org-only and unpublished threads whichever name wrote them.
      getIdentityIds(userId).catch(() => [userId]),
    ]);
    // Presence for "Who's here" — throttled inside to one write per 5 min.
    void touchLastSeen(userId);
    return { userId, roles, isGlobalAdmin: admin, identityIds, name: profile?.displayName ?? email };
  } catch (err) {
    console.error("[forum] getViewer:", err);
    return { ...FORUM_ANONYMOUS, name: null };
  }
}
