import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { getServerSession } from '@elkdonis/auth-server';

/**
 * GET /api/nextcloud/status
 *
 * Check if the current user is synced to Nextcloud.
 * Returns sync status and Nextcloud user info if synced.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's Nextcloud status from database
    const [user] = await db`
      SELECT
        id,
        email,
        display_name,
        is_admin,
        nextcloud_synced,
        nextcloud_user_id,
        nextcloud_app_password IS NOT NULL as has_app_password,
        nextcloud_oidc_synced
      FROM users
      WHERE id = ${session.user.id}
    `;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine user role/title based on sync status
    let role = 'member';
    let title = 'Member';

    if (user.is_admin && user.nextcloud_synced) {
      role = 'innermember';
      title = 'Inner Member';
    } else if (user.is_admin) {
      role = 'admin_pending';
      title = 'Admin (Pending Sync)';
    } else if (user.nextcloud_synced) {
      role = 'synced_member';
      title = 'Synced Member';
    }

    return NextResponse.json({
      synced: user.nextcloud_synced || false,
      oidcSynced: user.nextcloud_oidc_synced || false,
      hasAppPassword: user.has_app_password || false,
      nextcloudUserId: user.nextcloud_user_id,
      isAdmin: user.is_admin,
      role,
      title,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
    });
  } catch (error: any) {
    console.error('Error checking Nextcloud status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}
