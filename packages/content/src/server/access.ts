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
import type { ContentHost } from "../host";
import type { ContentScope } from "../search-types";

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

// ── content_index rights (CONTRACT.md §4), added 2026-11-26 ─────────────────

/** Anyone with the owner role on the host's site org, plus platform admins. Generalises `isMarketKeeper`. */
export function isSiteKeeper(r: ContentRights | null, host: ContentHost): boolean {
  return Boolean(r && (r.isAdmin || r.roles[host.site.orgId] === "owner"));
}

/** The org ids a site covers: its own org plus `storeOrgIds`. A row belongs when its site_org_id or org_id is among them. */
export const siteOrgIds = (host: ContentHost): string[] => [host.site.orgId, ...(host.site.storeOrgIds ?? [])];

export interface ContentReadOptions {
  /** A keeper or admin asks for hidden rows too; ignored (never honoured) for anyone else. */
  includeHidden?: boolean;
}

/**
 * SQL over alias `ci` (content_index): the rows of `scope` this viewer may read, by the one rule of
 * CONTRACT §4. Rights come from `rights` (resolveRights), never from the query.
 *
 *   network     public, published, not hidden: for everyone, signed in or not (`rights` may be null).
 *   otherwise   admin: every row. Else any of: site keeper (rows on the site, including drafts and
 *               hidden-by-keepers), owner (own rows), org manager (unpublished rows of the org, subject
 *               to min_role, same as `threadReadSql`), or the public clause (published; PUBLIC;
 *               ORGANIZATION for members; INVITE_ONLY when min_role is met). Hidden rows are removed
 *               for everyone unless a keeper or admin passes `includeHidden`.
 *
 * A null `scope` means no scope restriction (rights only), used to resolve stored references.
 * Throws for a null `rights` outside the network and person scopes.
 */
export function contentReadSql(rights: ContentRights | null, scope: ContentScope | null, host: ContentHost, opts: ContentReadOptions = {}) {
  if (scope?.kind === "network" || (scope === null && !rights)) {
    return db`(ci.status = 'published' AND NOT ci.hidden AND ci.visibility = 'PUBLIC')`;
  }
  if (scope?.kind === "person" && !rights) {
    // A signed-out visitor sees a person's published public work only.
    return db`((ci.owner_user_id = ${scope.userId}::uuid OR ci.owner_identity_id = ${scope.userId}::uuid)
      AND ci.status = 'published' AND NOT ci.hidden AND ci.visibility = 'PUBLIC')`;
  }
  if (!rights) throw new Error("contentReadSql: this scope needs a signed-in viewer");
  const r = rights;
  const ids = r.identityIds;
  const sites = siteOrgIds(host);

  const scopeSql =
    scope === null ? db`true`
    : scope.kind === "mine" || (scope.kind === "person" && scope.userId === r.userId) ? db`(ci.owner_user_id = ANY(${ids}::uuid[]) OR ci.owner_identity_id = ANY(${ids}::uuid[]))`
    : scope.kind === "person" ? db`(ci.owner_user_id = ${scope.userId}::uuid OR ci.owner_identity_id = ${scope.userId}::uuid)`
    : scope.kind === "org" ? db`(ci.org_id = ${scope.orgId} OR ci.store_id = ANY(ARRAY(
        SELECT (c.value->>'storeId')::uuid FROM site_config c
        WHERE c.org_id = ${scope.orgId} AND c.key = 'shop:store'
          AND c.value->>'storeId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')))`
    : db`(ci.site_org_id = ANY(${sites}::text[]) OR ci.org_id = ANY(${sites}::text[]))`;

  const keeper = isSiteKeeper(r, host);
  const hiddenOk = keeper && opts.includeHidden === true;
  const hiddenSql = hiddenOk ? db`true` : db`NOT ci.hidden`;
  if (r.isAdmin) return db`(${scopeSql} AND ${hiddenSql})`;

  const atLeast = (min: ThreadRole) => orgs(Object.entries(r.roles).filter(([, role]) => RANK_OF[role] >= RANK_OF[min]).map(([org]) => org));
  const strict = db`(
    (ci.min_role = 'viewer' AND ci.org_id = ANY(${atLeast("viewer")}::text[]))
    OR (ci.min_role = 'member' AND ci.org_id = ANY(${atLeast("member")}::text[]))
    OR (ci.min_role = 'guide' AND ci.org_id = ANY(${atLeast("guide")}::text[]))
    OR (ci.min_role = 'owner' AND ci.org_id = ANY(${atLeast("owner")}::text[]))
  )`;
  const keeperSql = keeper ? db`(ci.site_org_id = ANY(${sites}::text[]) OR ci.org_id = ANY(${sites}::text[]))` : db`false`;
  return db`(${scopeSql} AND ${hiddenSql} AND (
    ${keeperSql}
    OR ci.owner_user_id = ANY(${ids}::uuid[]) OR ci.owner_identity_id = ANY(${ids}::uuid[])
    OR (ci.status <> 'published' AND NOT ci.hidden AND ci.org_id = ANY(${orgs(r.managedOrgIds)}::text[]) AND (ci.min_role IS NULL OR ${strict}))
    OR (ci.status = 'published' AND NOT ci.hidden AND (
      ci.visibility = 'PUBLIC'
      OR (ci.visibility = 'ORGANIZATION' AND ci.org_id = ANY(${orgs(Object.keys(r.roles))}::text[]))
      OR (ci.visibility = 'INVITE_ONLY' AND ci.min_role IS NOT NULL AND ${strict})
    ))
  ))`;
}
