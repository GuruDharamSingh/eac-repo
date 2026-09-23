import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';
import { listOrgGrants, setOrgGrant, type OrgCapability } from '@elkdonis/services';

/**
 * GET   /api/organizations/grants          every org, with whether it holds the capability
 * PATCH /api/organizations/grants          { orgId, granted } — switch it on or off
 *
 * Network admin only. The one capability so far, 'nextcloud_access', lets an
 * org's OWNERS see their members' Nextcloud links and ask for a sync from
 * their own site (services/org-nextcloud-access.ts).
 */
const CAPABILITY: OrgCapability = 'nextcloud_access';

async function adminUserId(): Promise<string | null> {
  const session = await getServerSession();
  if (!session.user) return null;
  if (!(await isAdmin(session.user.id))) return null;
  return session.user.db_user_id ?? session.user.id;
}

export async function GET() {
  if (!(await adminUserId())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  return NextResponse.json({ capability: CAPABILITY, orgs: await listOrgGrants(CAPABILITY) });
}

export async function PATCH(request: NextRequest) {
  const userId = await adminUserId();
  if (!userId) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body?.orgId !== 'string' || typeof body?.granted !== 'boolean') {
    return NextResponse.json({ error: 'Expected { orgId, granted }' }, { status: 400 });
  }
  const r = await setOrgGrant(userId, body.orgId, CAPABILITY, body.granted);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
