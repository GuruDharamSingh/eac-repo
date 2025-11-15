import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/nextcloud';
import { db } from '@elkdonis/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
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

    // Sync user to Nextcloud
    const result = await userService.syncUser({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      orgId: user.org_ids?.[0], // Use first org
    });

    if (result.success) {
      // Update database with credentials
      await db`
        UPDATE users
        SET
          nextcloud_user_id = ${user.id},
          nextcloud_app_password = ${result.appPassword || null},
          nextcloud_synced = true,
          updated_at = NOW()
        WHERE id = ${user.id}
      `;

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
