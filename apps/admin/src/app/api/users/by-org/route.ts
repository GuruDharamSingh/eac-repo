import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

/**
 * GET /api/users/by-org?org=inner_group
 *
 * Get users filtered by organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const orgId = request.nextUrl.searchParams.get('org');

    // If no org specified, return all users
    if (!orgId || orgId === 'all') {
      const users = await db`
        SELECT
          u.id,
          u.email,
          u.display_name,
          u.is_admin,
          u.nextcloud_synced,
          u.nextcloud_user_id,
          u.created_at,
          array_agg(DISTINCT uo.org_id) FILTER (WHERE uo.org_id IS NOT NULL) as organizations
        FROM users u
        LEFT JOIN user_organizations uo ON u.id = uo.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `;

      return NextResponse.json({ users, orgId: 'all' });
    }

    // Get users for specific org
    const users = await db`
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.is_admin,
        u.nextcloud_synced,
        u.nextcloud_user_id,
        u.created_at,
        uo.role,
        uo.joined_at
      FROM users u
      JOIN user_organizations uo ON u.id = uo.user_id
      WHERE uo.org_id = ${orgId}
      ORDER BY uo.joined_at DESC
    `;

    return NextResponse.json({ users, orgId });
  } catch (error: any) {
    console.error('Error fetching users by org:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
