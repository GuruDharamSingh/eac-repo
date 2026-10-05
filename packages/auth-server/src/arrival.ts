import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from './index';
import { ARRIVAL_COOKIE } from './sso-state';

// ============================================================================
// The arrival notice: after the handoff accept (handoff.ts) records an
// arrival in network_arrivals it sets the readable `eac_arrival` cookie. The
// app's root layout renders @elkdonis/cms-ui/network's ArrivalNotice, which
// does nothing unless that cookie is present; then it GETs the app's
// /api/network/arrival (createArrivalHandler) for the text and POSTs to it to
// follow the org and/or clear the cookie. No server work in the layout, so a
// static page stays static.
// ============================================================================

export interface ArrivalNoticeData {
  orgName: string;
  fromLabel: string | null;
  who: string;
  role: string | null;
}

/** Props for ArrivalNotice when this visitor has an arrival to be told about on this org's site, else null. */
export async function loadArrivalNotice(orgId: string): Promise<ArrivalNoticeData | null> {
  try {
    const { cookies } = await import('next/headers');
    const arrivalId = (await cookies()).get(ARRIVAL_COOKIE)?.value;
    if (!arrivalId || !/^[0-9a-f-]{36}$/i.test(arrivalId)) return null;
    const session = await getServerSession();
    const userId = session.user?.db_user_id;
    if (!userId) return null;

    const { db } = await import('@elkdonis/db');
    const [row] = await db<Array<{
      org_name: string | null;
      from_host: string | null;
      from_org_name: string | null;
      role: string | null;
      display_name: string | null;
      email: string | null;
    }>>`
      SELECT o.name AS org_name, a.from_host, fo.name AS from_org_name, uo.role,
             u.display_name, u.email
      FROM network_arrivals a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN organizations o ON o.id = a.org_id
      LEFT JOIN organizations fo ON fo.id = a.from_org_id
      LEFT JOIN user_organizations uo ON uo.org_id = a.org_id AND uo.user_id = a.user_id
      WHERE a.id = ${arrivalId} AND a.user_id = ${userId} AND a.org_id = ${orgId}
    `;
    if (!row) return null;
    return {
      orgName: row.org_name ?? orgId,
      fromLabel: row.from_org_name ?? row.from_host,
      who: row.display_name || row.email || session.user?.email || 'you',
      role: row.role,
    };
  } catch (err) {
    console.warn('[arrival] notice not loaded:', (err as Error).message);
    return null;
  }
}

/**
 * /api/network/arrival —
 * `export const { GET, POST } = createArrivalHandler({ orgId: siteConfig.orgId })`.
 *   GET  → { notice: ArrivalNoticeData | null }
 *   POST { action: 'follow' | 'dismiss' } → clears the cookie; follow adds a
 *        `viewer` row (a follower, see followOrg in @elkdonis/services) and
 *        never changes an existing role.
 */
export function createArrivalHandler(options: { orgId: string }) {
  const GET = async (): Promise<NextResponse> => {
    const notice = await loadArrivalNotice(options.orgId);
    const response = NextResponse.json({ notice });
    if (!notice) response.cookies.set(ARRIVAL_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  };

  const POST = async (request: NextRequest): Promise<NextResponse> => {
    const session = await getServerSession();
    const userId = session.user?.db_user_id;
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    let action: unknown = null;
    try {
      action = ((await request.json()) as { action?: unknown }).action;
    } catch {
      /* treated as dismiss */
    }

    if (action === 'follow') {
      const { db } = await import('@elkdonis/db');
      await db`
        INSERT INTO user_organizations (user_id, org_id, role, joined_at)
        VALUES (${userId}, ${options.orgId}, 'viewer', NOW())
        ON CONFLICT (user_id, org_id) DO NOTHING
      `;
    }

    const response = NextResponse.json({ ok: true, followed: action === 'follow' });
    response.cookies.set(ARRIVAL_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  };

  return { GET, POST };
}
