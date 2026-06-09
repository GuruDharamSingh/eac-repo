import { redirect } from "next/navigation";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";
import { getMarketplaceArtist } from "@elkdonis/commerce/queries";
import type { MarketplaceArtist } from "@elkdonis/commerce/types";
import { db } from "@elkdonis/db";

/** Internal database user id (users.id), or null when signed out. */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const session = await getServerSession();
    if (!session.user) return null;
    return session.user.db_user_id ?? session.user.id;
  } catch {
    return null;
  }
}

export interface CurrentUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

/** Lightweight signed-in user info for the header / account page, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const session = await getServerSession();
    const user = session.user;
    if (!user) return null;
    const id = user.db_user_id ?? user.id;
    let displayName: string | null = null;
    try {
      const rows = (await db`
        SELECT display_name FROM users WHERE id = ${id} LIMIT 1
      `) as unknown as Array<{ display_name: string | null }>;
      displayName = rows[0]?.display_name ?? null;
    } catch {
      // non-fatal — fall back to email in the UI
    }
    return { id, email: user.email ?? null, displayName };
  } catch {
    return null;
  }
}

/** The signed-in user's marketplace artist record (any status), or null. */
export async function getCurrentArtist(): Promise<MarketplaceArtist | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return getMarketplaceArtist(userId);
}

/** Whether the signed-in user is a platform admin. */
export async function getIsAdmin(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;
  try {
    return await isAdmin(userId);
  } catch {
    return false;
  }
}

/**
 * Guard for studio pages: requires an approved (active) marketplace artist.
 * Redirects unauthenticated users to /login and non-approved users to the
 * apply/status page.
 */
export async function requireApprovedArtist(): Promise<{
  userId: string;
  artist: MarketplaceArtist;
}> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/studio");
  const artist = await getMarketplaceArtist(userId);
  if (!artist || artist.status !== "active") redirect("/studio/apply");
  return { userId, artist };
}

/** Guard for admin pages. Redirects non-admins away. */
export async function requireAdmin(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/admin/applications");
  const admin = await isAdmin(userId).catch(() => false);
  if (!admin) redirect("/");
  return userId;
}
