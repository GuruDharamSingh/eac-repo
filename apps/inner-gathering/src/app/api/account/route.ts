import { NextResponse } from 'next/server';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get full user data from database
    const [user] = await db`
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.avatar_url,
        u.bio,
        u.is_admin,
        u.nextcloud_synced,
        u.nextcloud_user_id,
        u.nextcloud_oidc_synced,
        u.created_at,
        u.updated_at,
        array_agg(DISTINCT uo.org_id) FILTER (WHERE uo.org_id IS NOT NULL) as organizations,
        array_agg(DISTINCT uo.role) FILTER (WHERE uo.role IS NOT NULL) as roles
      FROM users u
      LEFT JOIN user_organizations uo ON u.id = uo.user_id
      WHERE u.id = ${session.user.id}
      GROUP BY u.id
    `;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine user title based on role and sync status
    let title = 'Member';
    if (user.is_admin && user.nextcloud_synced) {
      title = 'Inner Member';
    } else if (user.is_admin) {
      title = 'Admin (Pending Sync)';
    } else if (user.nextcloud_synced) {
      title = 'Synced Member';
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        isAdmin: user.is_admin,
        nextcloudSynced: user.nextcloud_synced,
        nextcloudUserId: user.nextcloud_user_id,
        nextcloudOidcSynced: user.nextcloud_oidc_synced,
        organizations: user.organizations || [],
        roles: user.roles || [],
        title,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching account:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch account' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession();

    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { displayName, bio } = body;

    // Update user profile
    const [updated] = await db`
      UPDATE users
      SET
        display_name = COALESCE(${displayName}, display_name),
        bio = COALESCE(${bio}, bio),
        updated_at = NOW()
      WHERE id = ${session.user.id}
      RETURNING id, email, display_name, bio, updated_at
    `;

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.display_name,
        bio: updated.bio,
        updatedAt: updated.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error updating account:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update account' },
      { status: 500 }
    );
  }
}
