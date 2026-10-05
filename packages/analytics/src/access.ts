import { db } from '@elkdonis/db';
import { isAdmin } from '@elkdonis/auth-server';
import type { Scope } from './types';

// Who may see which analytics: network admins (users.is_admin) see the whole
// network and any org; an org owner sees only the orgs they own. Guides,
// members and followers see none: the numbers include signed-in people.

export interface AnalyticsAccess {
  /** May view the whole-network scope. */
  network: boolean;
  /** Orgs this user may view (all orgs for an admin). */
  orgs: Array<{ id: string; name: string }>;
}

export async function getAnalyticsAccess(userId: string): Promise<AnalyticsAccess> {
  if (await isAdmin(userId)) {
    const orgs = await db<Array<{ id: string; name: string }>>`SELECT id, name FROM organizations ORDER BY name`;
    return { network: true, orgs };
  }
  const orgs = await db<Array<{ id: string; name: string }>>`
    SELECT o.id, o.name FROM user_organizations uo JOIN organizations o ON o.id = uo.org_id
    WHERE uo.user_id = ${userId} AND uo.role = 'owner' ORDER BY o.name`;
  return { network: false, orgs };
}

/**
 * The scope to show for a requested org id (`null`/empty = whole network).
 * Returns null when the viewer may not see it. A non-admin with no org chosen
 * gets their first owned org.
 */
export function chooseScope(access: AnalyticsAccess, requestedOrg: string | null | undefined): Scope | null {
  if (!requestedOrg) {
    if (access.network) return { network: true };
    return access.orgs[0] ? { orgId: access.orgs[0].id } : null;
  }
  return access.orgs.some((o) => o.id === requestedOrg) ? { orgId: requestedOrg } : null;
}
