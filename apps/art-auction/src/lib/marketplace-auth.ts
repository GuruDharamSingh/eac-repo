import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";
import {
  getStoreForUser,
  listStoresForUser,
  type ActableStore,
} from "@elkdonis/commerce/queries";
import type { Store } from "@elkdonis/commerce/types";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

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
  slug: string | null;
}

/** Lightweight signed-in user info for the header / account page, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const session = await getServerSession();
    const user = session.user;
    if (!user) return null;
    const id = user.db_user_id ?? user.id;
    let displayName: string | null = null;
    let slug: string | null = null;
    try {
      const rows = (await db`
        SELECT display_name, slug FROM users WHERE id = ${id} LIMIT 1
      `) as unknown as Array<{ display_name: string | null; slug: string | null }>;
      displayName = rows[0]?.display_name ?? null;
      slug = rows[0]?.slug ?? null;
    } catch {
      // non-fatal — fall back to email in the UI
    }
    return { id, email: user.email ?? null, displayName, slug };
  } catch {
    return null;
  }
}

/** The signed-in user's OWN store in this marketplace (any status), or null. */
export async function getCurrentStore(): Promise<Store | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return getStoreForUser(userId, siteConfig.marketplaceOrgId);
}

/** @deprecated Use {@link getCurrentStore}. */
export const getCurrentArtist = getCurrentStore;

/**
 * Every store the signed-in user may act for: their own, plus org stores
 * they are on the roll of. Empty when signed out.
 */
export async function listActableStores(): Promise<ActableStore[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  try {
    return await listStoresForUser(userId);
  } catch {
    return [];
  }
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

// ─── Studio: which store is being worked on ─────────────────────────────────

/** Remembers the store a person last switched the studio to. */
export const STUDIO_STORE_COOKIE = "ea_studio_store";

export interface StudioContext {
  userId: string;
  /** The store the studio is showing. */
  store: ActableStore;
  /** Everything the person could switch to. */
  stores: ActableStore[];
}

/**
 * Pick the studio's current store: an explicit `?store=` wins, then the
 * cookie, then the person's own store, then the first active one.
 */
export async function resolveStudioStore(
  requested?: string | null
): Promise<{ userId: string | null; store: ActableStore | null; stores: ActableStore[] }> {
  const userId = await getCurrentUserId();
  if (!userId) return { userId: null, store: null, stores: [] };
  const stores = await listStoresForUser(userId);
  if (stores.length === 0) return { userId, store: null, stores };

  const jar = await cookies();
  const remembered = jar.get(STUDIO_STORE_COOKIE)?.value ?? null;
  const pick =
    (requested && stores.find((s) => s.id === requested)) ||
    (remembered && stores.find((s) => s.id === remembered)) ||
    stores.find((s) => s.ownerUserId === userId) ||
    stores.find((s) => s.status === "active") ||
    stores[0]!;
  return { userId, store: pick, stores };
}

/**
 * Guard for studio pages: a signed-in person with an ACTIVE store to act
 * for. Redirects to sign-in, or to the apply page when they have no store yet
 * or the chosen one is not approved.
 */
export async function requireStudioStore(
  requested?: string | null
): Promise<StudioContext> {
  const { userId, store, stores } = await resolveStudioStore(requested);
  if (!userId) redirect("/login?next=/studio");
  if (!store) redirect("/studio/apply");
  if (store.status !== "active") {
    // Fall back to any active store before bouncing to the status page.
    const active = stores.find((s) => s.status === "active");
    if (active) return { userId, store: active, stores };
    redirect("/studio/apply");
  }
  return { userId, store, stores };
}

/**
 * Compatibility guard for the older studio pages: same as
 * {@link requireStudioStore} with no explicit store. Returns the store under
 * both names.
 */
export async function requireApprovedArtist(): Promise<{
  userId: string;
  store: ActableStore;
  /** @deprecated Same object as `store`. */
  artist: ActableStore;
}> {
  const ctx = await requireStudioStore();
  return { userId: ctx.userId, store: ctx.store, artist: ctx.store };
}

/** Guard for admin pages. Redirects non-admins away. */
export async function requireAdmin(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/admin");
  const admin = await isAdmin(userId).catch(() => false);
  if (!admin) redirect("/");
  return userId;
}
