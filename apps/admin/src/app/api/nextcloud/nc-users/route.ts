import { NextResponse } from 'next/server';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

/**
 * GET /api/nextcloud/nc-users
 *
 * Fetches users directly from Nextcloud OCS API
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const nextcloudUrl = process.env.NEXTCLOUD_URL || 'http://nextcloud-nginx:80';
    const adminUser = process.env.NEXTCLOUD_ADMIN_USER || 'elkdonis';
    const adminPassword = process.env.NEXTCLOUD_ADMIN_PASSWORD || 'Ea4thway';

    // Fetch users from Nextcloud OCS API
    const response = await fetch(`${nextcloudUrl}/ocs/v1.php/cloud/users?format=json`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${adminUser}:${adminPassword}`).toString('base64'),
        'OCS-APIRequest': 'true',
      },
    });

    if (!response.ok) {
      throw new Error(`Nextcloud API error: ${response.status}`);
    }

    const data = await response.json();
    const userIds = data?.ocs?.data?.users || [];

    // Fetch details for each user (limit to first 50 for performance)
    const userDetails = await Promise.all(
      userIds.slice(0, 50).map(async (userId: string) => {
        try {
          const userResponse = await fetch(
            `${nextcloudUrl}/ocs/v1.php/cloud/users/${encodeURIComponent(userId)}?format=json`,
            {
              headers: {
                'Authorization': 'Basic ' + Buffer.from(`${adminUser}:${adminPassword}`).toString('base64'),
                'OCS-APIRequest': 'true',
              },
            }
          );

          if (userResponse.ok) {
            const userData = await userResponse.json();
            return {
              id: userId,
              displayName: userData?.ocs?.data?.displayname || userId,
              email: userData?.ocs?.data?.email || '',
              enabled: userData?.ocs?.data?.enabled ?? true,
              groups: userData?.ocs?.data?.groups || [],
              quota: userData?.ocs?.data?.quota || {},
              lastLogin: userData?.ocs?.data?.lastLogin || 0,
            };
          }
          return { id: userId, displayName: userId, email: '', enabled: true, groups: [] };
        } catch {
          return { id: userId, displayName: userId, email: '', enabled: true, groups: [] };
        }
      })
    );

    return NextResponse.json({
      users: userDetails,
      total: userIds.length,
    });
  } catch (error: any) {
    console.error('Error fetching Nextcloud users:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Nextcloud users' },
      { status: 500 }
    );
  }
}
