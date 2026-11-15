// ============================================================================
// @elkdonis/content/server: who may see and act on which items.
//
// The viewer is the signed-in user the caller resolved from
// getServerSession(); nothing here reads request params. Rights are resolved
// from the database (memberships, identities, users.is_admin), so a caller
// cannot pass a role in.
//
// Mirrors, and will replace, two helpers that exist twice today:
//   - apps/arts-collective/src/lib/channel/actions.ts `acting()` / `mayTouch()`
//     (managers = owner or guide of an org other than "oad")
//   - packages/services/src/thread-audience.ts `canViewThread()` (the read
//     rule: author, editors of the org, then visibility + min_role)
// `threadReadSql` is the SQL spelling of `canViewThread` so a list can page in
// the database; keep the two in step (2026-11-12).
// ============================================================================

import { db } from "@elkdonis/db";
import { getIdentityIds, listUserMemberships } from "@elkdonis/services";
import { RANK_OF, type ThreadRole } from "@elkdonis/services/thread-audience";

/** The personal org every "Just me" row lives under: a role on it manages nobody else's posts. */
export const PERSONAL_ORG = "oad";

export interface ContentViewer {
  /** users.id of the signed-in account. */
  userId: string;
}

export interface ContentRights {
  userId: string;
  isAdmin: boolean;
  /** The account id plus its live pseudonyms (services getIdentityIds). */
  identityIds: string[];
  /** Role in every org the viewer belongs to (reading rights). */
  roles: Record<string, ThreadRole>;
  /** Orgs the viewer owns or guides, "oad" excluded (managing rights). */
  managedOrgIds: string[];
}

export async function resolveRights(viewer: ContentViewer): Promise<ContentRights> {
  const [memberships, identityIds, admin] = await Promise.all([
    listUserMemberships(viewer.userId),
    getIdentityIds(viewer.userId),
    db<Array<{ is_admin: boolean }>>`SELECT is_admin FROM users WHERE id = ${viewer.userId}`.then((r) => Boolean(r[0]?.is_admin)),
  ]);
  const roles: Record<string, ThreadRole> = {};
  for (const m of memberships) roles[m.orgId] = m.role as ThreadRole;
  return {
    userId: viewer.userId,
    isAdmin: admin,
    identityIds,
    roles,
    managedOrgIds: memberships.filter((m) => (m.role === "owner" || m.role === "guide") && m.orgId !== PERSONAL_ORG).map((m) => m.orgId),
  };
}

/** Owns or guides this org (or is a platform admin). */
export function mayManageOrg(r: ContentRights, orgId: string): boolean {
  return r.isAdmin || r.managedOrgIds.includes(orgId);
}

const orgs = (list: string[]) => (list.length ? list : [""]);

/**
 * SQL over alias `t` (threads): the rows this viewer may read, the same rule as
 * `canViewThread` (thread-audience.ts):
 *   admin, or the author (any of the viewer's identities), or
 *   unpublished: an editor of the org whose role meets min_role, or
 *   published: PUBLIC; ORGANIZATION for any role in the org; INVITE_ONLY with a
 *   min_role the viewer's role in the org meets.
 * Requires threads.min_role (migration 188; present on elkdonis_dev 2026-11-12).
 */
export function threadReadSql(r: ContentRights) {
  if (r.isAdmin) return db`true`;
  const atLeast = (min: ThreadRole) => orgs(Object.entries(r.roles).filter(([, role]) => RANK_OF[role] >= RANK_OF[min]).map(([org]) => org));
  const strict = db`(
    (t.min_role = 'viewer' AND t.org_id = ANY(${atLeast("viewer")}))
    OR (t.min_role = 'member' AND t.org_id = ANY(${atLeast("member")}))
    OR (t.min_role = 'guide' AND t.org_id = ANY(${atLeast("guide")}))
    OR (t.min_role = 'owner' AND t.org_id = ANY(${atLeast("owner")}))
  )`;
  return db`(
    t.author_id = ANY(${r.identityIds})
    OR (t.status <> 'published' AND t.org_id = ANY(${orgs(r.managedOrgIds)}) AND (t.min_role IS NULL OR ${strict}))
    OR (t.status = 'published' AND (
      t.visibility = 'PUBLIC'
      OR (t.visibility = 'ORGANIZATION' AND t.org_id = ANY(${orgs(Object.keys(r.roles))}))
      OR (t.visibility = 'INVITE_ONLY' AND t.min_role IS NOT NULL AND ${strict})
    ))
  )`;
}
