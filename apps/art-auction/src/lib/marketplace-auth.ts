import { redirect } from "next/navigation";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";
import { getMarketplaceArtist } from "@elkdonis/commerce/queries";
import type { MarketplaceArtist } from "@elkdonis/commerce/types";

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
