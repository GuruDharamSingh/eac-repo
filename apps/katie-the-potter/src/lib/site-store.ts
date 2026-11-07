import { db } from "@elkdonis/db";
import { getStore } from "@elkdonis/commerce/queries";
import type { Store } from "@elkdonis/commerce/types";
import { davList, gainSpace, getStorageSlug, userStorageRoot } from "@elkdonis/services";
import { siteConfig } from "@/config/site";

// ============================================================================
// THE SITE'S STORE, and from it, THE ARTIST. Server only.
//
// Fixed 2026-11-06 (onboarding). The site used to find "the artist" as the
// earliest-joined `owner` of org katie-the-potter and then her store through
// that person. That breaks the moment the shop changes hands: after a claim
// the placeholder drops to viewer, and the earliest remaining owner can be a
// helper (an admin who was given owner to make the link), so the grid, the
// upload folder and the picture library all pointed at HIS account.
//
// Now the STORE is the source of truth:
//
//   site_config (org katie-the-potter, key `shop:store`) = { storeId }
//
//   the store   = that row in `store` (Collect Art, org `market`)
//   the artist  = store.owner_user_id (whoever owns the store today)
//
// A claim (lib/manage-claim.ts) moves store.owner_user_id and never the store
// id, so the pin stays valid through any hand-over with nothing to update.
// Site EDITING permission is a separate thing and stays role-based
// (owner/guide in user_organizations, lib/auth.ts).
//
// Before the pin existed it is derived once, the old way (an org owner's
// store in `market`, the store-holding owner first), and written, so the first
// request after deploy pins today's store. Nothing here throws to a page.
// ============================================================================

export const SITE_STORE_KEY = "shop:store";
const MARKET_ORG = "market";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTL_MS = 60_000;

let cached: { store: Store | null; at: number } | null = null;

/** Drop the cached store (after a hand-over, so the site follows the new owner at once). */
export function forgetPinnedStore(): void {
  cached = null;
}

/** The pinned store id, or null when nothing is pinned. Never throws. */
export async function readPinnedStoreId(): Promise<string | null> {
  try {
    const [row] = await db<Array<{ value: { storeId?: unknown } | null }>>`
      SELECT value FROM site_config WHERE org_id = ${siteConfig.orgId} AND key = ${SITE_STORE_KEY} LIMIT 1
    `;
    const id = row?.value?.storeId;
    return typeof id === "string" && UUID.test(id) ? id : null;
  } catch (err) {
    console.error("[katie-the-potter] readPinnedStoreId:", err);
    return null;
  }
}

/**
 * Pin `storeId` as the site's store. Only fills an empty pin unless `replace`
 * is set (moving the site to another store is a deliberate act, not a side
 * effect of a read).
 */
export async function pinStore(storeId: string, opts: { replace?: boolean } = {}): Promise<void> {
  if (!UUID.test(storeId)) throw new Error("pinStore: not a store id");
  const value = { storeId, pinnedAt: new Date().toISOString() };
  await (opts.replace
    ? db`
        INSERT INTO site_config (org_id, key, value) VALUES (${siteConfig.orgId}, ${SITE_STORE_KEY}, ${db.json(value)})
        ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
      `
    : db`
        INSERT INTO site_config (org_id, key, value) VALUES (${siteConfig.orgId}, ${SITE_STORE_KEY}, ${db.json(value)})
        ON CONFLICT (org_id, key) DO NOTHING
      `);
  forgetPinnedStore();
}

/** The pre-pin rule, used once to seed the pin: a store in `market` owned by an owner of this org. */
async function deriveStoreId(): Promise<string | null> {
  const [row] = await db<Array<{ id: string }>>`
    SELECT s.id FROM user_organizations uo
    JOIN store s ON s.owner_user_id = uo.user_id AND s.org_id = ${MARKET_ORG}
    WHERE uo.org_id = ${siteConfig.orgId} AND uo.role = 'owner'
    ORDER BY uo.joined_at ASC
    LIMIT 1
  `;
  return row?.id ?? null;
}

/** The site's store in any status (null before one exists). Cached a minute. */
export async function getPinnedStore(): Promise<Store | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.store;
  let store: Store | null = null;
  try {
    let id = await readPinnedStoreId();
    if (!id) {
      const derived = await deriveStoreId();
      if (derived) {
        await pinStore(derived);
        id = await readPinnedStoreId(); // whatever won, if two requests raced
      }
    }
    store = id ? await getStore(id) : null;
  } catch (err) {
    console.error("[katie-the-potter] getPinnedStore:", err);
  }
  cached = { store, at: Date.now() };
  return store;
}

/** The artist: whoever owns the site's store today (store.owner_user_id). */
export async function getStoreOwnerUserId(): Promise<string | null> {
  const store = await getPinnedStore();
  return store?.ownerUserId ?? null;
}

// ── The artist's picture folder ─────────────────────────────────────────────
//
// Uploads land in EAC_Network/users/<users.storage_folder>/Media/Images. A
// brand-new account has the column (set from its slug on sign-up) but no
// folder in Nextcloud yet, and WebDAV refuses a PUT into a missing folder.
// gainSpace (@elkdonis/services) is how the platform makes it: oad
// membership, roster and artist profile rows, and the Media/* folders. It is
// idempotent, so calling it again is always safe.

export interface PictureFolder {
  slug: string | null;
  ready: boolean;
}

/** Whether the person's picture folder exists (Media/ lists its sub-folders once made). */
export async function pictureFolderStatus(userId: string): Promise<PictureFolder> {
  try {
    const slug = await getStorageSlug(userId);
    if (!slug) return { slug: null, ready: false };
    const entries = await davList(`${userStorageRoot(slug)}/Media`);
    return { slug, ready: entries.length > 0 };
  } catch (err) {
    console.error("[katie-the-potter] pictureFolderStatus:", err);
    return { slug: null, ready: false };
  }
}

/** Make the person's picture folder (gainSpace). Never throws; true when it is ready. */
export async function ensurePictureFolder(userId: string): Promise<boolean> {
  try {
    const r = await gainSpace(userId);
    if (!r.storageReady) console.error(`[katie-the-potter] gainSpace(${userId}): storage not ready`);
    return r.storageReady;
  } catch (err) {
    console.error("[katie-the-potter] ensurePictureFolder:", err);
    return false;
  }
}
