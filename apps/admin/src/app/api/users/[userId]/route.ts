import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

/**
 * GET /api/users/[userId]
 *
 * Get user details including sync status and admin status.
 * Requires admin access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { userId } = await params;

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
      WHERE u.id = ${userId}
      GROUP BY u.id
    `;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine title
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
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/[userId]
 *
 * Update user details including admin status.
 * Requires admin access.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { userId } = await params;
    const body = await request.json();
    const { isAdmin: newIsAdmin, displayName, bio } = body;

    // Build dynamic update query
    const updates: Record<string, any> = {};
    if (typeof newIsAdmin === 'boolean') {
      updates.is_admin = newIsAdmin;
    }
    if (typeof displayName === 'string') {
      updates.display_name = displayName;
    }
    if (typeof bio === 'string') {
      updates.bio = bio;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    // Check if user exists
    const [existingUser] = await db`
      SELECT id, email FROM users WHERE id = ${userId}
    `;

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user
    const [updated] = await db`
      UPDATE users
      SET
        is_admin = COALESCE(${updates.is_admin ?? null}::boolean, is_admin),
        display_name = COALESCE(${updates.display_name ?? null}, display_name),
        bio = COALESCE(${updates.bio ?? null}, bio),
        updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, email, display_name, is_admin, nextcloud_synced, updated_at
    `;

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.display_name,
        isAdmin: updated.is_admin,
        nextcloudSynced: updated.nextcloud_synced,
        updatedAt: updated.updated_at,
      },
      message: `User ${updated.email} updated successfully`,
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}
