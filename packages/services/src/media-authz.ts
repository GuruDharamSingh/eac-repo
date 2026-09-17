/**
 * Authorization for media reads served out of Nextcloud.
 *
 * Every app fetches media through a single Nextcloud service account
 * (NEXTCLOUD_ADMIN_USER), so Nextcloud sees one identity on every request and
 * cannot distinguish "the robot fetching for Dana" from "the robot fetching
 * for someone who guessed a URL". No amount of Nextcloud ACL configuration
 * changes that. Storage-layer ACLs govern humans logged into Nextcloud
 * directly; THIS module is what governs /api/media/*.
 *
 * Before this existed, the media proxies gated `/Private/` on nothing more
 * than "is there a session at all" (and packages/blog-server did not check at
 * all), so any signed-in user of any app could read any org's private media by
 * guessing a path.
 *
 * The rule set is deliberately narrow, so that adopting it changes nothing for
 * public media:
 *
 *   public  path  -> anyone, signed in or not (unchanged)
 *   private org   -> must be affiliated with that org (see isOrgAffiliate:
 *                    a role in user_organizations OR a row in org_profiles,
 *                    because the two tables disagree)
 *   private user  -> must be that user, or share an org with them
 *
 * Paths are parsed, never trusted: the caller passes the raw request path and
 * gets back a decision. Permission is never inferred from a path's *shape*
 * beyond locating the owning principal — the database is the authority.
 */

import { db } from '@elkdonis/db';
import { canEditOrgIdentity } from './org-domains';
import { isEnrolledInWorkshop } from './workshop-offerings';
import { getIdentityIds } from './identities';

/** Matches both spellings in the wild: code writes EAC_Network, migrations
 *  043/053/055 seeded EAC-Network. Both address the same Team folder. */
const ROOT_PATTERN = /^EAC[_-]Network$/i;

/** The principal a media path belongs to, plus whether it is private. */
export type MediaTarget =
  | { kind: 'org'; orgId: string; isPrivate: boolean }
  | { kind: 'user'; slug: string; isPrivate: boolean }
  /**
   * `EAC_Network/<org>/workshops/<threadId>/...` — a workshop's own folder,
   * where its materials live. Always private: course material is for the
   * people in the course. Before this branch existed the folder parsed as a
   * public org path, and every media proxy served the PDFs in it to anyone
   * who had the URL, while the Nextcloud shares that were supposed to gate
   * them only ever governed humans logged into Nextcloud.
   */
  | { kind: 'workshop'; orgId: string; threadId: string; isPrivate: true };

/**
 * Resolve a storage path to its owning principal.
 *
 * Returns null for anything malformed or outside the network root — callers
 * should treat null as "deny", not as "public".
 */
export function parseMediaPath(rawPath: string): MediaTarget | null {
  if (!rawPath) return null;

  // Traversal and separator smuggling. Checked before splitting so that a
  // segment like ".." can never survive normalization.
  if (
    rawPath.includes('..') ||
    rawPath.includes('\\') ||
    rawPath.includes('\0')
  ) {
    return null;
  }

  const segments = rawPath.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  if (!ROOT_PATTERN.test(segments[0])) return null;

  // Case-insensitive, and anywhere in the path. Matching loosely here only
  // ever classifies MORE files as private, which is the safe direction.
  const isPrivate = segments.some((s) => s.toLowerCase() === 'private');

  // EAC_Network/users/<slug>/...
  if (segments[1].toLowerCase() === 'users') {
    if (segments.length < 3) return null;
    return { kind: 'user', slug: segments[2], isPrivate };
  }

  // EAC_Network/<org_id>/workshops/<thread_id>/...
  if (segments[2]?.toLowerCase() === 'workshops') {
    if (segments.length < 4) return null;
    return { kind: 'workshop', orgId: segments[1], threadId: segments[3], isPrivate: true };
  }

  // EAC_Network/<org_id>/...
  return { kind: 'org', orgId: segments[1], isPrivate };
}

/**
 * Accept either identifier a caller is likely to have.
 *
 * getServerSession() returns `id` (the auth uuid) alongside `db_user_id`
 * (public.users.id). Migration 012 aligned the two for most rows but they are
 * not guaranteed equal, and passing the wrong one would silently deny access
 * rather than error. Resolving both here removes that trap from every route.
 */
async function resolveViewerId(viewerId: string): Promise<string | null> {
  try {
    const rows = await db<Array<{ id: string }>>`
      SELECT id FROM users
      WHERE id = ${viewerId} OR auth_user_id = ${viewerId}
      LIMIT 1
    `;
    return rows[0]?.id ?? null;
  } catch (err) {
    console.error('[media-authz] resolveViewerId:', err);
    return null;
  }
}

async function getUserIdBySlug(slug: string): Promise<string | null> {
  try {
    const rows = await db<Array<{ id: string }>>`
      SELECT id FROM users WHERE slug = ${slug} LIMIT 1
    `;
    return rows[0]?.id ?? null;
  } catch (err) {
    console.error(`[media-authz] getUserIdBySlug(${slug}):`, err);
    return null;
  }
}

/**
 * Is this person part of this organization?
 *
 * Deliberately broader than getOrgRole(). Membership is recorded in two
 * places and they do not agree: `user_organizations` carries a role, while
 * `org_profiles` carries the org's roster. IFAC's 18 artists were imported
 * into org_profiles only (all is_public), so a role-based check would deny
 * every one of them access to their own org's private media.
 *
 * For "may this person see the org's files", either record means yes.
 * Role still governs what they can DO — this is only about affiliation.
 */
async function isOrgAffiliate(userId: string, orgId: string): Promise<boolean> {
  try {
    const rows = await db<Array<{ ok: number }>>`
      SELECT 1 AS ok
      WHERE EXISTS (
              SELECT 1 FROM user_organizations
              WHERE user_id = ${userId} AND org_id = ${orgId}
                -- 'viewer' is what the ungated self-join route hands out, so
                -- accepting it here would let anyone grant themselves read
                -- access to any org's private media in two requests. Every
                -- other role is conferred by someone who already holds the org.
                AND role <> 'viewer'
            )
         OR EXISTS (
              SELECT 1 FROM org_profiles
              WHERE user_id = ${userId} AND org_id = ${orgId}
            )
    `;
    return rows.length > 0;
  } catch (err) {
    console.error(`[media-authz] isOrgAffiliate(${orgId}):`, err);
    return false;
  }
}

/** Do these two people belong to at least one organization in common? */
async function sharesOrg(viewerId: string, ownerId: string): Promise<boolean> {
  try {
    // Same two-table reality as isOrgAffiliate: an org shared only via
    // org_profiles still counts.
    const rows = await db<Array<{ ok: number }>>`
      WITH viewer_orgs AS (
        -- Same 'viewer' exclusion as isOrgAffiliate, and for the same reason:
        -- the self-join route hands that role out ungated, so counting it
        -- let anyone follow an org to read its members' private files.
        SELECT org_id FROM user_organizations
        WHERE user_id = ${viewerId} AND role <> 'viewer'
        UNION
        SELECT org_id FROM org_profiles      WHERE user_id = ${viewerId}
      ),
      owner_orgs AS (
        SELECT org_id FROM user_organizations WHERE user_id = ${ownerId}
        UNION
        SELECT org_id FROM org_profiles      WHERE user_id = ${ownerId}
      )
      SELECT 1 AS ok
      FROM viewer_orgs JOIN owner_orgs USING (org_id)
      LIMIT 1
    `;
    return rows.length > 0;
  } catch (err) {
    console.error('[media-authz] sharesOrg:', err);
    return false;
  }
}

/**
 * May this viewer read this media path?
 *
 * `viewerId` is the platform users.id, or null for an anonymous request.
 * Fails closed: any parse failure or database error denies.
 */
export async function canReadMedia(
  viewerId: string | null,
  rawPath: string
): Promise<boolean> {
  const target = parseMediaPath(rawPath);
  if (!target) return false;

  // Public media stays public — anonymous visitors load org site imagery.
  if (!target.isPrivate) return true;

  if (!viewerId) return false;

  // Accepts a users.id or an auth uuid; see resolveViewerId.
  const viewer = await resolveViewerId(viewerId);
  if (!viewer) return false;

  if (target.kind === 'org') {
    return isOrgAffiliate(viewer, target.orgId);
  }

  if (target.kind === 'workshop') {
    return canAccessWorkshopMaterials(viewer, target.orgId, target.threadId);
  }

  const ownerId = await getUserIdBySlug(target.slug);
  if (!ownerId) return false;
  if (ownerId === viewer) return true;

  // Interim rule until users.media_visibility and
  // organizations.member_media_policy exist: sharing an org is what grants
  // sight of a member's private media. Once those two dials land, this
  // becomes their intersection.
  return sharesOrg(viewer, ownerId);
}

/**
 * May this person open a workshop's materials?
 *
 * The author, anyone enrolled (an RSVP of "yes", or a paid join), or someone
 * who runs the org. The same rule the workshop page uses to decide whether
 * to show the folder, so what is listed and what is downloadable never
 * disagree. Scoped to the org the path names: a thread id that exists in a
 * different org does not unlock a folder here.
 */
export async function canAccessWorkshopMaterials(
  userId: string,
  orgId: string,
  threadId: string
): Promise<boolean> {
  try {
    const [thread] = await db<Array<{ author_id: string | null }>>`
      SELECT author_id FROM threads
      WHERE id = ${threadId} AND org_id = ${orgId} AND kind = 'workshop'
      LIMIT 1
    `;
    if (!thread) return false;
    // The author test runs over every name this account writes as: a workshop
    // convened under a pen name is still the convener's to open.
    if (thread.author_id) {
      const mine = await getIdentityIds(userId);
      if (mine.includes(thread.author_id)) return true;
    }
    if (await isEnrolledInWorkshop(threadId, userId)) return true;
    return canEditOrgIdentity(userId, orgId);
  } catch (err) {
    console.error(`[media-authz] canAccessWorkshopMaterials(${orgId}, ${threadId}):`, err);
    return false;
  }
}
