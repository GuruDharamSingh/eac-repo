import { NextResponse } from 'next/server';
import { userService } from '@/lib/nextcloud';
import { db } from '@elkdonis/db';

export async function POST() {
  try {
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
    let errors = [];

    for (const user of users) {
      try {
        // Skip if already synced (unless you want to update)
        if (user.nextcloud_synced) {
          continue;
        }

        // Sync user to Nextcloud
        const success = await userService.syncUser({
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          orgId: user.org_ids?.[0], // Use first org for now
        });

        if (success) {
          // Mark as synced in database
          await db`
            UPDATE users
            SET
              nextcloud_user_id = ${user.id},
              nextcloud_synced = true,
              updated_at = NOW()
            WHERE id = ${user.id}
          `;
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