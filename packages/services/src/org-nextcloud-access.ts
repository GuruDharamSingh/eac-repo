import { db } from '@elkdonis/db';
import type { OrgRole } from './org-membership';

// ============================================================================
// Nextcloud access, as an org OWNER sees it — shared by every org site.
//
// Two gates, both required:
//   1. the network admin has granted the org the 'nextcloud_access'
//      capability (org_grants, migration 139) — an org role alone is never
//      enough; and
//   2. the viewer is an OWNER of that org.
//
// What an owner can do here is deliberately small: see which of their
// members are linked to Nextcloud (and so will get the circle, the team
// folder and their users/<slug> folder), and ask for a sync. The sync itself
// is scripts/sync-nextcloud-access.sh, which needs `occ` on the Docker host —
// no app container can run it — so asking writes a nextcloud_sync_requests
// row that scripts/nc-sync-queue.sh on the host picks up.
//
// Account creation is NOT offered: creating Nextcloud users over the admin API
// is blocked by Nextcloud's password-confirmation gate. A member links their
// own account by signing in to Nextcloud with "Sign in with Elkdonis".
//
// Boundary, as in org-membership.ts: nothing here sets users.is_admin. It is
// only READ, by setOrgGrant, to refuse anyone who isn't the network admin.
// ============================================================================

export type OrgCapability = 'nextcloud_access';

export type NextcloudSyncStatus = 'pending' | 'running' | 'done' | 'failed';

export interface NextcloudSyncRequest {
  id: string;
  reason: string;
  status: NextcloudSyncStatus;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  requestedBy: string | null;
  detail: string | null;
}

export interface NextcloudAccessMember {
  userId: string;
  displayName: string;
  email: string | null;
  role: Exclude<OrgRole, 'viewer'>;
  /** Their Nextcloud user id, once they've signed in there with Elkdonis. */
  nextcloudUserId: string | null;
}

export interface NextcloudAccessOverview {
  orgId: string;
  orgName: string;
  /** Where the org's shared files live on Nextcloud. */
  folderPath: string;
  hasCircle: boolean;
  /** Owners, guides and members — the people the sync gives access to. */
  members: NextcloudAccessMember[];
  /** Followers. Counted, not listed: the sync gives them nothing, by design. */
  viewerCount: number;
  pending: boolean;
  recent: NextcloudSyncRequest[];
  lastDoneAt: string | null;
}

const ROOT = process.env.NEXTCLOUD_ORG_ROOT_FOLDER || 'EAC_Network';
/** Same alias table as scripts/apply-team-folder-acls.mjs FOLDER_TO_ORG. */
const ORG_TO_FOLDER: Record<string, string> = { oad: 'artdirect' };

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

// ── grants ─────────────────────────────────────────────────────────────────

export async function hasOrgGrant(orgId: string, capability: OrgCapability): Promise<boolean> {
  const [row] = await db`
    SELECT 1 FROM org_grants WHERE org_id = ${orgId} AND capability = ${capability}
  `;
  return Boolean(row);
}

/** Every org, with whether it holds this capability — the admin's list. */
export async function listOrgGrants(capability: OrgCapability): Promise<Array<{
  orgId: string;
  orgName: string;
  granted: boolean;
  grantedAt: string | null;
  ownerCount: number;
}>> {
  const rows = await db<Array<{
    id: string; name: string; granted_at: Date | null; owner_count: number;
  }>>`
    SELECT o.id, o.name, g.granted_at,
           (SELECT COUNT(*)::int FROM user_organizations uo
             WHERE uo.org_id = o.id AND uo.role = 'owner') AS owner_count
    FROM organizations o
    LEFT JOIN org_grants g ON g.org_id = o.id AND g.capability = ${capability}
    ORDER BY o.name
  `;
  return rows.map((r) => ({
    orgId: r.id,
    orgName: r.name,
    granted: r.granted_at !== null,
    grantedAt: iso(r.granted_at),
    ownerCount: r.owner_count,
  }));
}

/**
 * Grant or withdraw a capability. Refuses anyone who isn't the network admin
 * (users.is_admin) — checked here as well as in the admin app's route, so a
 * second caller added later cannot forget it.
 */
export async function setOrgGrant(
  adminUserId: string,
  orgId: string,
  capability: OrgCapability,
  granted: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [admin] = await db<Array<{ is_admin: boolean }>>`
    SELECT is_admin FROM users WHERE id = ${adminUserId}
  `;
  if (!admin?.is_admin) return { ok: false, error: 'Only the network admin can change this.' };
  const [org] = await db`SELECT 1 FROM organizations WHERE id = ${orgId}`;
  if (!org) return { ok: false, error: 'No such organization.' };

  if (granted) {
    await db`
      INSERT INTO org_grants (org_id, capability, granted_by)
      VALUES (${orgId}, ${capability}, ${adminUserId})
      ON CONFLICT (org_id, capability) DO NOTHING
    `;
  } else {
    await db`DELETE FROM org_grants WHERE org_id = ${orgId} AND capability = ${capability}`;
  }
  return { ok: true };
}

// ── the owner's gate ─────────────────────────────────────────────────────────

/** Owner of this org AND the org holds the grant. */
export async function canManageNextcloudAccess(userId: string, orgId: string): Promise<boolean> {
  const [row] = await db`
    SELECT 1
    FROM user_organizations uo
    JOIN org_grants g ON g.org_id = uo.org_id AND g.capability = 'nextcloud_access'
    WHERE uo.user_id = ${userId} AND uo.org_id = ${orgId} AND uo.role = 'owner'
  `;
  return Boolean(row);
}

// ── reads ────────────────────────────────────────────────────────────────────

export async function getNextcloudAccessOverview(orgId: string): Promise<NextcloudAccessOverview | null> {
  const [org] = await db<Array<{ id: string; name: string; nextcloud_circle_id: string | null }>>`
    SELECT id, name, nextcloud_circle_id FROM organizations WHERE id = ${orgId}
  `;
  if (!org) return null;

  const [members, [viewers], recent] = await Promise.all([
    db<Array<{
      user_id: string; display_name: string | null; email: string | null;
      role: Exclude<OrgRole, 'viewer'>; nextcloud_user_id: string | null;
    }>>`
      SELECT u.id AS user_id, u.display_name, u.email, uo.role, u.nextcloud_user_id
      FROM user_organizations uo
      JOIN users u ON u.id = uo.user_id
      WHERE uo.org_id = ${orgId} AND uo.role <> 'viewer'
      ORDER BY CASE uo.role WHEN 'owner' THEN 0 WHEN 'guide' THEN 1 ELSE 2 END,
               u.display_name NULLS LAST
    `,
    db<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n FROM user_organizations
      WHERE org_id = ${orgId} AND role = 'viewer'
    `,
    listNextcloudSyncRequests(orgId, 5),
  ]);

  const lastDone = recent.find((r) => r.status === 'done');
  return {
    orgId: org.id,
    orgName: org.name,
    folderPath: `${ROOT}/${ORG_TO_FOLDER[org.id] ?? org.id}`,
    hasCircle: Boolean(org.nextcloud_circle_id),
    members: members.map((m) => ({
      userId: m.user_id,
      displayName: m.display_name || m.email || 'Unnamed',
      email: m.email,
      role: m.role,
      nextcloudUserId: m.nextcloud_user_id,
    })),
    viewerCount: viewers?.n ?? 0,
    pending: recent.some((r) => r.status === 'pending'),
    recent,
    lastDoneAt: lastDone?.finishedAt ?? null,
  };
}

export async function listNextcloudSyncRequests(orgId: string, limit = 5): Promise<NextcloudSyncRequest[]> {
  const rows = await db<Array<{
    id: string; reason: string; status: NextcloudSyncStatus;
    requested_at: Date; started_at: Date | null; finished_at: Date | null;
    requested_by_name: string | null; detail: string | null;
  }>>`
    SELECT r.id::text AS id, r.reason, r.status, r.requested_at, r.started_at, r.finished_at,
           COALESCE(u.display_name, u.email) AS requested_by_name, r.detail
    FROM nextcloud_sync_requests r
    LEFT JOIN users u ON u.id = r.requested_by
    WHERE r.org_id = ${orgId}
    ORDER BY r.requested_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    status: r.status,
    requestedAt: iso(r.requested_at)!,
    startedAt: iso(r.started_at),
    finishedAt: iso(r.finished_at),
    requestedBy: r.requested_by_name,
    detail: r.detail,
  }));
}

// ── writes ───────────────────────────────────────────────────────────────────

/**
 * Queue a sync for this org. No gate: this is also what a system path calls
 * (an approved profile claim, a new Nextcloud link) — owner-facing callers
 * go through createNextcloudAccessRoutes, which gates first. Idempotent while
 * one is pending: the partial unique index collapses repeats into that row.
 */
export async function requestNextcloudSync(
  orgId: string,
  requestedBy: string | null,
  reason: string = 'manual'
): Promise<{ id: string; alreadyPending: boolean }> {
  const [row] = await db<Array<{ id: string }>>`
    INSERT INTO nextcloud_sync_requests (org_id, requested_by, reason)
    VALUES (${orgId}, ${requestedBy}, ${reason.slice(0, 40)})
    ON CONFLICT (org_id) WHERE status = 'pending' DO NOTHING
    RETURNING id::text AS id
  `;
  if (row) return { id: row.id, alreadyPending: false };
  const [pending] = await db<Array<{ id: string }>>`
    SELECT id::text AS id FROM nextcloud_sync_requests
    WHERE org_id = ${orgId} AND status = 'pending'
  `;
  return { id: pending?.id ?? '', alreadyPending: true };
}

// ── the viewer's own cloud (the hub's Cloud card) ────────────────────────────

export interface ViewerCloud {
  /** They've signed in to Nextcloud with Elkdonis at least once. */
  linked: boolean;
  /** Nextcloud's public origin, e.g. https://cloud.elkdonis-arts.org. */
  nextcloudUrl: string;
  /** Deep link into the org's team folder in Nextcloud's Files app. */
  teamFolderUrl: string;
  teamFolderLabel: string;
  /** Deep link to their own users/<slug> folder, when they have a slug. */
  personalFolderUrl: string | null;
}

/**
 * What the hub's Cloud card shows one member. No org gate here — the hub is
 * members-only already, and this reveals nothing but the viewer's own link
 * and two folder paths.
 *
 * Why a card and not an iframe: Nextcloud refuses to be framed
 * (frame-ancestors 'self'), and its session cookies are SameSite=Lax/Strict,
 * which browsers never send inside a cross-site frame — on ifacgroup.com the
 * person could never stay signed in inside it. So the card links out.
 */
export async function getViewerCloud(userId: string, orgId: string): Promise<ViewerCloud> {
  const [u] = await db<Array<{ nextcloud_user_id: string | null; slug: string | null }>>`
    SELECT nextcloud_user_id, slug FROM users WHERE id = ${userId}
  `;
  const nc = (process.env.NEXTCLOUD_PUBLIC_URL || process.env.NEXT_PUBLIC_NEXTCLOUD_URL || 'https://cloud.elkdonis-arts.org')
    .replace(/\/$/, '');
  // The EAC_Network group folder is mounted at each member's root, so these
  // are the paths Nextcloud's Files app shows them.
  const filesAt = (dir: string) => `${nc}/apps/files/files?dir=${encodeURIComponent('/' + dir)}`;
  const team = `${ROOT}/${ORG_TO_FOLDER[orgId] ?? orgId}`;
  return {
    linked: Boolean(u?.nextcloud_user_id),
    nextcloudUrl: nc,
    teamFolderUrl: filesAt(team),
    teamFolderLabel: team,
    personalFolderUrl: u?.slug ? filesAt(`${ROOT}/users/${u.slug}`) : null,
  };
}

// ── the host's route ─────────────────────────────────────────────────────────

export interface NextcloudAccessRouteHandlers {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/**
 * GET → the overview; POST → queue a sync. A host supplies its org and who is
 * asking; the owner-plus-grant rule lives here, so every org site mounts the
 * same few lines and none can get the gate wrong.
 */
export function createNextcloudAccessRoutes(opts: {
  orgId: string;
  viewer: () => Promise<{ userId: string } | null>;
}): NextcloudAccessRouteHandlers {
  async function gate(): Promise<{ userId: string } | Response> {
    const viewer = await opts.viewer().catch(() => null);
    if (!viewer) return json({ error: 'Sign in first.' }, 401);
    if (!(await hasOrgGrant(opts.orgId, 'nextcloud_access'))) {
      return json({ error: 'The network admin has not turned this on for this organization.' }, 403);
    }
    if (!(await canManageNextcloudAccess(viewer.userId, opts.orgId))) {
      return json({ error: 'Only an owner of this organization can do this.' }, 403);
    }
    return viewer;
  }

  return {
    async GET() {
      const g = await gate();
      if (g instanceof Response) return g;
      const overview = await getNextcloudAccessOverview(opts.orgId);
      if (!overview) return json({ error: 'No such organization.' }, 404);
      return json(overview);
    },
    async POST() {
      const g = await gate();
      if (g instanceof Response) return g;
      const r = await requestNextcloudSync(opts.orgId, g.userId, 'owner');
      return json({ ok: true, ...r });
    },
  };
}
