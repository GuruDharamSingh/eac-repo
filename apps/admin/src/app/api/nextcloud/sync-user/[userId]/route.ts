import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { handleUserProvisioning } from '@elkdonis/services';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Auth check - require admin
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { userId } = await params;

    // Get user from database
    const [user] = await db`
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.nextcloud_synced,
        array_agg(uo.org_id) as org_ids
      FROM users u
      LEFT JOIN user_organizations uo ON u.id = uo.user_id
      WHERE u.id = ${userId}
      GROUP BY u.id, u.email, u.display_name, u.nextcloud_synced
    `;

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.nextcloud_synced) {
      return NextResponse.json(
        { error: 'User already synced' },
        { status: 400 }
      );
    }

    const result = await handleUserProvisioning(
      user.id,
      user.email,
      user.display_name || user.email.split('@')[0],
      {
        groups: Array.isArray(user.org_ids)
          ? user.org_ids.filter((orgId: unknown): orgId is string => typeof orgId === 'string' && orgId.length > 0)
          : undefined,
      }
    );

    if (result.success) {
      await db`UPDATE users SET updated_at = NOW() WHERE id = ${user.id}`;

      return NextResponse.json({
        success: true,
        message: `User ${user.email} synced successfully`,
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to sync user' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error syncing user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync user' },
      { status: 500 }
    );
  }
}
