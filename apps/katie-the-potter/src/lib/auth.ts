import { redirect } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import { getOrgRole, type OrgRole } from "@elkdonis/services";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { forgetPinnedStore, getStoreOwnerUserId } from "@/lib/site-store";

/**
 * Access control for the site, following danamccool's src/lib/auth.ts.
 *
 * One rule: a person can edit this site if they hold `owner` or `guide` in
 * `user_organizations` for org `katie-the-potter` (migration 243 seeds the
 * owner row once a user with the configured email exists).
 */

export const EDITOR_ROLES: OrgRole[] = ["owner", "guide"];

export interface Viewer {
  userId: string;
  email: string;
  role: OrgRole | null;
  canEdit: boolean;
}

/** The current viewer, or null when signed out. Never throws or redirects. */
export async function getViewer(): Promise<Viewer | null> {
  const session = await getServerSession();
  if (!session.user) return null;

  const userId = session.user.db_user_id ?? session.user.id;
  const role = await getOrgRole(userId, siteConfig.orgId);

  return {
    userId,
    email: session.user.email,
    role,
    canEdit: role !== null && EDITOR_ROLES.includes(role),
  };
}

/** Route-handler / server-action equivalent of requireOrgEditor: null instead of a redirect. */
export async function getApiEditor(): Promise<Viewer | null> {
  const viewer = await getViewer();
  return viewer?.canEdit ? viewer : null;
}

/** Gate for editing routes/actions. Redirects signed-out visitors to login. */
export async function requireOrgEditor(returnTo = "/manage"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!viewer.canEdit) redirect("/");
  return viewer;
}

/**
 * THE ARTIST: the account the site is about, independent of who is signed in
 * (public pages need it for an anonymous visitor too).
 *
 * Fixed 2026-11-06: this is the owner of the site's pinned STORE
 * (lib/site-store.ts, site_config `shop:store` → store.owner_user_id), not
 * "the earliest org owner". After a hand-over the placeholder drops to
 * viewer and a helper may still be an owner; the store's owner is always the
 * artist. Before any store exists it falls back to the earliest `owner` row,
 * then to the configured email. Cached a minute (the store's own cache).
 */
let cachedOwner: { id: string | null; at: number } | null = null;
const OWNER_TTL_MS = 60_000;

/** Drop the cached artist and store (after a hand-over, so the site follows the new owner at once). */
export function forgetSiteOwner(): void {
  cachedOwner = null;
  forgetPinnedStore();
}

export async function getSiteArtistUserId(): Promise<string | null> {
  if (cachedOwner && Date.now() - cachedOwner.at < OWNER_TTL_MS) return cachedOwner.id;
  let id: string | null = await getStoreOwnerUserId();
  if (!id) {
    try {
      const [byRole] = await db<Array<{ user_id: string }>>`
        SELECT user_id FROM user_organizations
        WHERE org_id = ${siteConfig.orgId} AND role = 'owner'
        ORDER BY joined_at
        LIMIT 1
      `;
      if (byRole?.user_id) {
        id = byRole.user_id;
      } else {
        const [byEmail] = await db<Array<{ id: string }>>`
          SELECT id FROM users WHERE lower(email) = lower(${siteConfig.ownerEmail}) LIMIT 1
        `;
        id = byEmail?.id ?? null;
      }
    } catch (err) {
      console.error("[katie-the-potter] getSiteArtistUserId:", err);
    }
  }
  cachedOwner = { id, at: Date.now() };
  return id;
}

/**
 * Kept under its old name for existing callers (lib/manage.ts): it now means
 * the ARTIST, i.e. the store's owner. See getSiteArtistUserId.
 */
export const getSiteOwnerUserId = getSiteArtistUserId;
