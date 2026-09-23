import { getServerSession, isAdmin } from "@elkdonis/auth-server";
import { getViewerRoles, getProfile } from "@elkdonis/services";
import type { LmsHostViewer } from "@elkdonis/lms-ui";
import { cache } from "react";

const ANON: LmsHostViewer = { userId: null, roles: {}, name: null };

/**
 * The current viewer, never throwing: every page renders for everyone.
 * getViewerRoles applies stewardship (migration 138), so the inner group's
 * owners are guides of the `elkdonis` org here exactly as they are on the forum.
 *
 * SOPHIA_DEV_VIEWER_ID (never in production) impersonates a users.id.
 */
export const getViewer = cache(async (): Promise<LmsHostViewer> => {
  try {
    const devId = process.env.NODE_ENV !== "production" ? process.env.SOPHIA_DEV_VIEWER_ID : undefined;
    let userId: string;
    let email: string | null = null;
    if (devId) {
      userId = devId;
    } else {
      const session = await getServerSession();
      if (!session.user) return ANON;
      userId = session.user.db_user_id ?? session.user.id;
      email = session.user.email;
    }
    const [roles, admin, profile] = await Promise.all([getViewerRoles(userId), isAdmin(userId), getProfile(userId).catch(() => null)]);
    return { userId, roles, isGlobalAdmin: admin, name: profile?.displayName ?? email?.split("@")[0] ?? null };
  } catch (err) {
    console.error("[sophia] getViewer:", err);
    return ANON;
  }
});
