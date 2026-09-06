import { redirect } from "next/navigation";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";
import { getStoreForUser } from "@elkdonis/commerce/queries";
import type { Store } from "@elkdonis/commerce/types";
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

/** The signed-in user's own store (any status), or null. */
export async function getCurrentStore(): Promise<Store | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return getStoreForUser(userId);
}

/** @deprecated Use {@link getCurrentStore}. */
export const getCurrentArtist = getCurrentStore;

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
 * Guard for studio pages: requires an approved (active) store.
 * Redirects unauthenticated users to /login and non-approved users to the
 * apply/status page.
 *
 * Returns the store as well as the user id — writes key off `store.id` since
 * migration 094, because a person can hold one store per marketplace and a
 * user id alone no longer names one.
 */
export async function requireApprovedArtist(): Promise<{
  userId: string;
  store: Store;
  /** @deprecated Same object as `store`. */
  artist: Store;
}> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/studio");
  const store = await getStoreForUser(userId);
  if (!store || store.status !== "active") redirect("/studio/apply");
  return { userId, store, artist: store };
}

/** Guard for admin pages. Redirects non-admins away. */
export async function requireAdmin(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/admin/applications");
  const admin = await isAdmin(userId).catch(() => false);
  if (!admin) redirect("/");
  return userId;
}
