import { db } from '@elkdonis/db';

// ============================================================================
// Org-scoped membership, roles, and followers — shared across every app.
//
// Boundary (deliberate, security-relevant): everything in this file is
// scoped to a single org (owner/guide/member/viewer within THAT org only).
// It must never grow a function that sets the global `users.is_admin`
// superadmin flag — that grant is intentionally kept exclusive to
// apps/admin's own routes (port 3000). An org role here can never imply
// platform-wide admin access, by construction: OrgRole has no 'admin'
// value, and nothing here touches the `users` table's own columns.
// ============================================================================

export type OrgRole = 'owner' | 'guide' | 'member' | 'viewer';

export interface OrgMembership {
  userId: string;
  orgId: string;
  role: OrgRole;
  joinedAt: Date;
}

export interface OrgMember extends OrgMembership {
  email: string;
  displayName: string | null;
  /** Global superadmin flag — read-only here, informational only. Granting
   *  it is out of scope for this module; see apps/admin's own user routes. */
  isAdmin: boolean;
  nextcloudSynced: boolean;
  nextcloudUserId: string | null;
  createdAt: Date;
}

export interface OrgFollower {
  userId: string;
  orgId: string;
  followedAt: Date;
  email: string;
  displayName: string | null;
}

/** This user's role in this org, or null if they're not a member. */
export async function getOrgRole(userId: string, orgId: string): Promise<OrgRole | null> {
  const [row] = await db<Array<{ role: OrgRole }>>`
    SELECT role FROM user_organizations
    WHERE user_id = ${userId} AND org_id = ${orgId}
  `;
  return row?.role ?? null;
}

/** Whether this user's role in this org is one of the allowed roles. */
export async function hasOrgRole(
  userId: string,
  orgId: string,
  allowed: OrgRole[]
): Promise<boolean> {
  const role = await getOrgRole(userId, orgId);
  return role !== null && allowed.includes(role);
}

/** Whether this user holds one of the allowed roles in ANY org — for
 *  nav-style gating ("is this user a guide of something") where the
 *  specific org doesn't matter. */
export async function hasAnyOrgRole(userId: string, allowed: OrgRole[]): Promise<boolean> {
  const [row] = await db`
    SELECT 1 FROM user_organizations
    WHERE user_id = ${userId} AND role = ANY(${allowed})
    LIMIT 1
  `;
  return Boolean(row);
}

/** All members of an org, with their role. */
export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const rows = await db<Array<{
    user_id: string;
    org_id: string;
    role: OrgRole;
    joined_at: Date;
    email: string;
    display_name: string | null;
    is_admin: boolean;
    nextcloud_synced: boolean;
    nextcloud_user_id: string | null;
    created_at: Date;
  }>>`
    SELECT
      uo.user_id, uo.org_id, uo.role, uo.joined_at,
      u.email, u.display_name, u.is_admin,
      u.nextcloud_synced, u.nextcloud_user_id, u.created_at
    FROM user_organizations uo
    JOIN users u ON u.id = uo.user_id
    WHERE uo.org_id = ${orgId}
    ORDER BY uo.joined_at DESC
  `;
  return rows.map((r) => ({
    userId: r.user_id,
    orgId: r.org_id,
    role: r.role,
    joinedAt: r.joined_at,
    email: r.email,
    displayName: r.display_name,
    isAdmin: r.is_admin,
    nextcloudSynced: r.nextcloud_synced,
    nextcloudUserId: r.nextcloud_user_id,
    createdAt: r.created_at,
  }));
}

/** Every org a user belongs to, with their role in each. */
export async function listUserMemberships(userId: string): Promise<Array<OrgMembership & { orgName: string; orgSlug: string }>> {
  const rows = await db<Array<{
    org_id: string;
    role: OrgRole;
    joined_at: Date;
    org_name: string;
    org_slug: string;
  }>>`
    SELECT uo.org_id, uo.role, uo.joined_at, o.name AS org_name, o.slug AS org_slug
    FROM user_organizations uo
    JOIN organizations o ON o.id = uo.org_id
    WHERE uo.user_id = ${userId}
    ORDER BY o.name
  `;
  return rows.map((r) => ({
    userId,
    orgId: r.org_id,
    role: r.role,
    joinedAt: r.joined_at,
    orgName: r.org_name,
    orgSlug: r.org_slug,
  }));
}

/** The org this user owns, if any — for "claim one org" flows (signup
 *  wizards, subdomain setup) that need to find or gate on existing
 *  ownership rather than list every membership. */
export async function getOwnedOrgId(userId: string): Promise<string | null> {
  const [row] = await db<Array<{ org_id: string }>>`
    SELECT org_id FROM user_organizations
    WHERE user_id = ${userId} AND role = 'owner'
    LIMIT 1
  `;
  return row?.org_id ?? null;
}

/** Add a member or change their role in an org. Idempotent. */
export async function setOrgRole(
  userId: string,
  orgId: string,
  role: OrgRole
): Promise<OrgMembership> {
  const [row] = await db<Array<{ user_id: string; org_id: string; role: OrgRole; joined_at: Date }>>`
    INSERT INTO user_organizations (user_id, org_id, role, joined_at)
    VALUES (${userId}, ${orgId}, ${role}, NOW())
    ON CONFLICT (user_id, org_id)
    DO UPDATE SET role = EXCLUDED.role
    RETURNING user_id, org_id, role, joined_at
  `;
  return { userId: row.user_id, orgId: row.org_id, role: row.role, joinedAt: row.joined_at };
}

/** Remove a member from an org. Returns false if they weren't a member. */
export async function removeOrgMember(userId: string, orgId: string): Promise<boolean> {
  const result = await db`
    DELETE FROM user_organizations
    WHERE user_id = ${userId} AND org_id = ${orgId}
    RETURNING user_id
  `;
  return result.length > 0;
}

// ─── Followers ────────────────────────────────────────────────────────────
// A follower IS a `viewer` row in user_organizations (decision 7 in
// CENTER_PAGE_BRIEF_2026-09-09.md): one lightweight relation, not two. The
// old org_followers table (migration 072) is no longer written or read here;
// it never held a row. Following an org you already belong to is a no-op —
// a member is already "following" in every sense the UI shows.

export async function isFollowingOrg(userId: string, orgId: string): Promise<boolean> {
  const role = await getOrgRole(userId, orgId);
  return role !== null;
}

export async function followOrg(userId: string, orgId: string): Promise<void> {
  await db`
    INSERT INTO user_organizations (user_id, org_id, role, joined_at)
    VALUES (${userId}, ${orgId}, 'viewer', NOW())
    ON CONFLICT (user_id, org_id) DO NOTHING
  `;
}

/** Only a viewer row is removed — unfollowing never demotes a member. */
export async function unfollowOrg(userId: string, orgId: string): Promise<void> {
  await db`
    DELETE FROM user_organizations
    WHERE user_id = ${userId} AND org_id = ${orgId} AND role = 'viewer'
  `;
}

export async function listOrgFollowers(orgId: string): Promise<OrgFollower[]> {
  const rows = await db<Array<{
    user_id: string;
    org_id: string;
    followed_at: Date;
    email: string;
    display_name: string | null;
  }>>`
    SELECT uo.user_id, uo.org_id, uo.joined_at AS followed_at, u.email, u.display_name
    FROM user_organizations uo
    JOIN users u ON u.id = uo.user_id
    WHERE uo.org_id = ${orgId} AND uo.role = 'viewer'
    ORDER BY uo.joined_at DESC
  `;
  return rows.map((r) => ({
    userId: r.user_id,
    orgId: r.org_id,
    followedAt: r.followed_at,
    email: r.email,
    displayName: r.display_name,
  }));
}

export async function getOrgFollowerCount(orgId: string): Promise<number> {
  const [{ count }] = await db<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM user_organizations WHERE org_id = ${orgId} AND role = 'viewer'
  `;
  return count;
}
