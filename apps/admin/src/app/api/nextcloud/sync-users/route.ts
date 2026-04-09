import { NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { handleUserProvisioning } from '@elkdonis/services';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

export async function POST() {
  try {
    // Auth check - require admin
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all users from database
    const users = await db`
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.nextcloud_synced,
        array_agg(uo.org_id) as org_ids
      FROM users u
      LEFT JOIN user_organizations uo ON u.id = uo.user_id
      GROUP BY u.id, u.email, u.display_name, u.nextcloud_synced
    `;

    let syncedCount = 0;
    const errors = [];

    for (const user of users) {
      try {
        // Skip if already synced (unless you want to update)
        if (user.nextcloud_synced) {
          continue;
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
          syncedCount++;
        }
      } catch (error: any) {
        console.error(`Error syncing user ${user.email}:`, error);
        errors.push({ user: user.email, error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${syncedCount} users`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error syncing users:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync users' },
      { status: 500 }
    );
  }
}
