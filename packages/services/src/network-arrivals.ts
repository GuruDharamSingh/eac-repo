import { db } from '@elkdonis/db';
import type { OrgRole } from './org-membership';

// ============================================================================
// Network arrivals (migration 164): a signed-in person reaching an org's site
// through the SSO handoff. Rows are written by @elkdonis/auth-server's
// handoff accept, which also reads one back for the arrival notice
// (arrival.ts there). This module lists them for the org's people page.
// ============================================================================

export interface OrgArrival {
  id: string;
  userId: string;
  email: string;
  displayName: string | null;
  path: string | null;
  fromHost: string | null;
  fromOrgName: string | null;
  arrivedAt: Date;
  role: OrgRole | null;
}

/** Recent arrivals on this org's site, newest first. */
export async function listOrgArrivals(orgId: string, limit = 50): Promise<OrgArrival[]> {
  const rows = await db<Array<{
    id: string;
    user_id: string;
    email: string;
    display_name: string | null;
    path: string | null;
    from_host: string | null;
    from_org_name: string | null;
    arrived_at: Date;
    role: OrgRole | null;
  }>>`
    SELECT a.id, a.user_id, u.email, u.display_name, a.path, a.from_host,
           fo.name AS from_org_name, a.arrived_at, uo.role
    FROM network_arrivals a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN organizations fo ON fo.id = a.from_org_id
    LEFT JOIN user_organizations uo ON uo.org_id = a.org_id AND uo.user_id = a.user_id
    WHERE a.org_id = ${orgId}
    ORDER BY a.arrived_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    path: r.path,
    fromHost: r.from_host,
    fromOrgName: r.from_org_name,
    arrivedAt: r.arrived_at,
    role: r.role,
  }));
}
