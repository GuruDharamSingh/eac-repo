import { db } from '@elkdonis/db';
import { getOrgRole, removeOrgMember, setOrgRole, type OrgRole } from './org-membership';
import { requestNextcloudSync } from './org-nextcloud-access';

// ============================================================================
// An organisation's people, for its owners and guides: who is in it, with
// what access, whether the public site lists them, and who has just arrived.
//
// One shared read and two shared writes (2026-10-18). IFAC's /manage/people
// (`apps/ifac/src/lib/manage.ts`) and innergathering's /manage/people each
// had their own copy of this; the Center's "Your organisation" journey needs
// it on every org site, so the rules live here once:
//
//   - access and listing are independent and shown side by side
//   - an actor may not change their own access, nor an owner's (central
//     admin does that), and may grant viewer | member | guide only
//   - listing an untagged roster row tags it `artist`, because public rosters
//     list only artist/dealer rows and an untagged public row shows nowhere
//   - a role change asks for a Nextcloud sync: member and guide carry cloud
//     access, viewer does not
// ============================================================================

export const ASSIGNABLE_ORG_ROLES: OrgRole[] = ['viewer', 'member', 'guide'];

export interface OrgPerson {
  userId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: OrgRole;
  joinedAt: string;
  /** The org's roster row, when there is one. */
  listing: { isPublic: boolean; slug: string | null; kind: 'artist' | 'dealer' } | null;
  /** Their most recent arrival on this org's site through the network, if recorded. */
  arrivedAt: string | null;
  /** Where that arrival came from, when known. */
  arrivedFrom: string | null;
  /** A follower who signed up in the last fortnight: the row that wants a decision. */
  isNew: boolean;
}

export interface OrgPeopleResult {
  ok: boolean;
  error?: string;
}

interface Row {
  user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: OrgRole;
  joined_at: Date;
  slug: string | null;
  tags: string[] | null;
  is_public: boolean | null;
  arrived_at: Date | null;
  arrived_from: string | null;
}

const NEW_DAYS = 14;

/** Everyone in the org: owners first, then guides, members, viewers; newest viewers first. */
export async function listOrgPeople(orgId: string): Promise<OrgPerson[]> {
  const rows = await db<Row[]>`
    SELECT
      uo.user_id, uo.role, uo.joined_at,
      u.email, u.display_name, u.avatar_url, u.slug,
      op.tags, op.is_public,
      a.arrived_at, COALESCE(fo.name, a.from_host) AS arrived_from
    FROM user_organizations uo
    JOIN users u ON u.id = uo.user_id
    LEFT JOIN org_profiles op ON op.user_id = uo.user_id AND op.org_id = uo.org_id
    LEFT JOIN LATERAL (
      SELECT arrived_at, from_host, from_org_id FROM network_arrivals
      WHERE org_id = uo.org_id AND user_id = uo.user_id
      ORDER BY arrived_at DESC LIMIT 1
    ) a ON TRUE
    LEFT JOIN organizations fo ON fo.id = a.from_org_id
    WHERE uo.org_id = ${orgId}
    ORDER BY
      CASE uo.role WHEN 'owner' THEN 0 WHEN 'guide' THEN 1 WHEN 'member' THEN 2 ELSE 3 END,
      CASE WHEN uo.role = 'viewer' THEN uo.joined_at END DESC NULLS LAST,
      u.display_name NULLS LAST, u.email
  `;
  const cutoff = Date.now() - NEW_DAYS * 86_400_000;
  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    role: r.role,
    joinedAt: new Date(r.joined_at).toISOString(),
    listing:
      r.is_public === null
        ? null
        : { isPublic: r.is_public, slug: r.slug, kind: r.tags?.includes('dealer') ? 'dealer' : 'artist' },
    arrivedAt: r.arrived_at ? new Date(r.arrived_at).toISOString() : null,
    arrivedFrom: r.arrived_from,
    isNew: r.role === 'viewer' && new Date(r.joined_at).getTime() > cutoff,
  }));
}

/** May this person change the org's people at all? Owners and guides. */
export async function canManageOrgPeople(actorUserId: string, orgId: string): Promise<boolean> {
  const role = await getOrgRole(actorUserId, orgId);
  return role === 'owner' || role === 'guide';
}

/**
 * May this person change other people's role, listing or membership? Owners
 * only (2026-11-08, Justin: the hub Members spec's roles table). Guides still
 * see people and arrivals (`canManageOrgPeople`) and may welcome an arrival as
 * a viewer (`welcomeOrgArrival`); nobody grants owner from here.
 */
export async function canChangeOrgPeople(actorUserId: string, orgId: string): Promise<boolean> {
  return (await getOrgRole(actorUserId, orgId)) === 'owner';
}

async function guard(orgId: string, targetUserId: string, actorUserId: string): Promise<OrgPeopleResult> {
  if (!targetUserId) return { ok: false, error: 'A person is required.' };
  if (!(await canChangeOrgPeople(actorUserId, orgId))) return { ok: false, error: 'Only owners change roles.' };
  if (targetUserId === actorUserId) return { ok: false, error: "You can't change your own access here." };
  const role = await getOrgRole(targetUserId, orgId);
  if (role === null) return { ok: false, error: "That person isn't in this organisation." };
  if (role === 'owner') return { ok: false, error: "An owner's access is changed in central admin, not here." };
  return { ok: true };
}

/** Access within the org: viewer | member | guide. Never owner, never is_admin. */
export async function setOrgPersonRole(
  orgId: string,
  targetUserId: string,
  actorUserId: string,
  role: string
): Promise<OrgPeopleResult> {
  if (!ASSIGNABLE_ORG_ROLES.includes(role as OrgRole)) return { ok: false, error: 'Pick viewer, member or guide.' };
  const allowed = await guard(orgId, targetUserId, actorUserId);
  if (!allowed.ok) return allowed;
  await setOrgRole(targetUserId, orgId, role as OrgRole);
  // Member and guide carry Nextcloud access; a demotion takes it away. The
  // reconciler (scripts/sync-nextcloud-access.sh) does the work; this only asks.
  await requestNextcloudSync(orgId, actorUserId, 'role-change').catch((err) =>
    console.error('[org-people] requestNextcloudSync:', err)
  );
  return { ok: true };
}

/** Show or hide them on the org's public site. Their account and content survive. */
export async function setOrgPersonListed(
  orgId: string,
  targetUserId: string,
  actorUserId: string,
  isPublic: boolean
): Promise<OrgPeopleResult> {
  // Hiding yourself is legitimate; changing anyone else goes through the guard.
  if (targetUserId !== actorUserId) {
    const allowed = await guard(orgId, targetUserId, actorUserId);
    if (!allowed.ok) return allowed;
  }
  if (isPublic) {
    await db`
      UPDATE org_profiles SET tags = array_append(COALESCE(tags, '{}'), 'artist'), updated_at = NOW()
      WHERE org_id = ${orgId} AND user_id = ${targetUserId}
        AND NOT (COALESCE(tags, '{}') && ARRAY['artist', 'dealer']::text[])
    `;
  }
  const rows = await db<Array<{ user_id: string }>>`
    UPDATE org_profiles SET is_public = ${isPublic}, updated_at = NOW()
    WHERE org_id = ${orgId} AND user_id = ${targetUserId}
    RETURNING user_id
  `;
  return rows.length > 0 ? { ok: true } : { ok: false, error: 'That person has no profile on this site to list.' };
}


// ─── Hub Members card (2026-11-08, docs/open/hub-cards-handoff/PLAN.md §2) ───

/** Remove someone from the org: unlisted, membership row gone, storage revoked at the next sync. Owners only. */
export async function removeOrgPerson(orgId: string, targetUserId: string, actorUserId: string): Promise<OrgPeopleResult> {
  const allowed = await guard(orgId, targetUserId, actorUserId);
  if (!allowed.ok) return allowed;
  await db`UPDATE org_profiles SET is_public = false, updated_at = NOW() WHERE org_id = ${orgId} AND user_id = ${targetUserId}`;
  await removeOrgMember(targetUserId, orgId);
  await requestNextcloudSync(orgId, actorUserId, 'removal').catch((err) =>
    console.error('[org-people] requestNextcloudSync:', err)
  );
  return { ok: true };
}

export interface OrgArrivalQueueItem {
  /** The oldest open network_arrivals row for this person. */
  arrivalId: string;
  userId: string;
  email: string;
  displayName: string | null;
  handle: string | null;
  fromHost: string | null;
  fromOrgName: string | null;
  arrivedAt: string;
}

/** 42703 = undefined column: migration 258 (network_arrivals handled_at/outcome) not applied yet. */
const isMissingColumn = (err: unknown) => (err as { code?: string })?.code === '42703';

/**
 * The arrivals queue, oldest first: signed-in people who came over from another
 * site and are not yet a member, guide or owner (a self-follow viewer is still
 * waiting). Rows handled by migration 258's columns drop out; before that
 * migration every arrival counts as open.
 */
export async function listOrgArrivalQueue(orgId: string, limit = 100): Promise<OrgArrivalQueueItem[]> {
  type Row = { id: string; user_id: string; email: string; display_name: string | null; handle: string | null; from_host: string | null; from_org_name: string | null; arrived_at: Date };
  const query = (handled: boolean) => db<Row[]>`
    SELECT DISTINCT ON (a.user_id)
           a.id::text AS id, a.user_id::text AS user_id, u.email, u.display_name,
           NULLIF(split_part(u.email, '@', 1), '') AS handle,
           a.from_host, fo.name AS from_org_name, a.arrived_at
    FROM network_arrivals a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN organizations fo ON fo.id = a.from_org_id
    LEFT JOIN user_organizations uo ON uo.org_id = a.org_id AND uo.user_id = a.user_id
    WHERE a.org_id = ${orgId}
      AND (uo.role IS NULL OR uo.role = 'viewer')
      ${handled ? db`AND a.handled_at IS NULL` : db``}
    ORDER BY a.user_id, a.arrived_at ASC
  `;
  let rows: Row[];
  try {
    rows = await query(true);
  } catch (err) {
    if (!isMissingColumn(err)) throw err;
    rows = await query(false);
  }
  return rows
    .sort((x, y) => new Date(x.arrived_at).getTime() - new Date(y.arrived_at).getTime())
    .slice(0, limit)
    .map((r) => ({
      arrivalId: r.id,
      userId: r.user_id,
      email: r.email,
      displayName: r.display_name,
      handle: r.handle,
      fromHost: r.from_host,
      fromOrgName: r.from_org_name,
      arrivedAt: new Date(r.arrived_at).toISOString(),
    }));
}

async function markArrivalHandled(orgId: string, userId: string, actorUserId: string, outcome: 'welcomed' | 'dismissed'): Promise<boolean> {
  try {
    await db`
      UPDATE network_arrivals SET handled_at = NOW(), handled_by = ${actorUserId}, outcome = ${outcome}
      WHERE org_id = ${orgId} AND user_id = ${userId} AND handled_at IS NULL
    `;
    return true;
  } catch (err) {
    if (isMissingColumn(err)) return false;
    throw err;
  }
}

async function loadArrival(orgId: string, arrivalId: string): Promise<{ userId: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(arrivalId)) return null;
  const [row] = await db<Array<{ user_id: string }>>`
    SELECT user_id::text AS user_id FROM network_arrivals WHERE id = ${arrivalId} AND org_id = ${orgId} LIMIT 1
  `;
  return row ? { userId: row.user_id } : null;
}

/**
 * Welcome an arrival with a role. Owners pick viewer, member or guide; guides
 * welcome as viewer only. They join unlisted, and a storage sync is queued.
 */
export async function welcomeOrgArrival(orgId: string, arrivalId: string, actorUserId: string, role: string): Promise<OrgPeopleResult> {
  if (!ASSIGNABLE_ORG_ROLES.includes(role as OrgRole)) return { ok: false, error: 'Pick viewer, member or guide.' };
  const actorRole = await getOrgRole(actorUserId, orgId);
  if (actorRole !== 'owner' && actorRole !== 'guide') return { ok: false, error: 'Only owners and guides welcome arrivals.' };
  if (actorRole === 'guide' && role !== 'viewer') return { ok: false, error: 'Guides welcome arrivals as viewers; owners give other roles.' };
  const arrival = await loadArrival(orgId, arrivalId);
  if (!arrival) return { ok: false, error: 'That arrival is no longer waiting.' };
  if (arrival.userId === actorUserId) return { ok: false, error: "You can't change your own access here." };
  const current = await getOrgRole(arrival.userId, orgId);
  if (current && current !== 'viewer') return { ok: false, error: 'They are already part of this organisation.' };
  await setOrgRole(arrival.userId, orgId, role as OrgRole);
  await markArrivalHandled(orgId, arrival.userId, actorUserId, 'welcomed');
  await requestNextcloudSync(orgId, actorUserId, 'welcome').catch((err) =>
    console.error('[org-people] requestNextcloudSync:', err)
  );
  return { ok: true };
}

/** Take someone off the arrivals queue without a role. Needs migration 258. */
export async function dismissOrgArrival(orgId: string, arrivalId: string, actorUserId: string): Promise<OrgPeopleResult> {
  if (!(await canManageOrgPeople(actorUserId, orgId))) return { ok: false, error: 'Only owners and guides welcome arrivals.' };
  const arrival = await loadArrival(orgId, arrivalId);
  if (!arrival) return { ok: false, error: 'That arrival is no longer waiting.' };
  const done = await markArrivalHandled(orgId, arrival.userId, actorUserId, 'dismissed');
  return done ? { ok: true } : { ok: false, error: 'Dismissing arrivals needs a database update that is not applied yet.' };
}
