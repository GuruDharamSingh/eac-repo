import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

/**
 * GET /api/users/[userId]/org-role
 *
 * Get user's organization memberships and roles
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

    const memberships = await db`
      SELECT 
        uo.org_id,
        uo.role,
        uo.joined_at,
        o.name as org_name
      FROM user_organizations uo
      JOIN organizations o ON o.id = uo.org_id
      WHERE uo.user_id = ${userId}
      ORDER BY o.name
    `;

    return NextResponse.json({ memberships });
  } catch (error: any) {
    console.error('Error fetching user org roles:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user org roles' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/[userId]/org-role
 *
 * Update user's role in an organization or add them to an organization
 * Body: { orgId: string, role: 'guide' | 'member' | 'viewer' }
 */
export async function PUT(
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
    const { orgId, role } = body;

    if (!orgId || !role) {
      return NextResponse.json(
        { error: 'orgId and role are required' },
        { status: 400 }
      );
    }

    const validRoles = ['guide', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if user exists
    const [user] = await db`SELECT id, email FROM users WHERE id = ${userId}`;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if org exists
    const [org] = await db`SELECT id, name FROM organizations WHERE id = ${orgId}`;
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Upsert the membership
    const [membership] = await db`
      INSERT INTO user_organizations (user_id, org_id, role, joined_at)
      VALUES (${userId}, ${orgId}, ${role}, NOW())
      ON CONFLICT (user_id, org_id)
      DO UPDATE SET role = ${role}
      RETURNING user_id, org_id, role, joined_at
    `;

    return NextResponse.json({
      success: true,
      membership: {
        userId: membership.user_id,
        orgId: membership.org_id,
        role: membership.role,
        joinedAt: membership.joined_at,
      },
      message: `User ${user.email} is now a ${role} in ${org.name}`,
    });
  } catch (error: any) {
    console.error('Error updating user org role:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user org role' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/[userId]/org-role
 *
 * Remove user from an organization
 * Body: { orgId: string }
 */
export async function DELETE(
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
    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    // Delete the membership
    const result = await db`
      DELETE FROM user_organizations
      WHERE user_id = ${userId} AND org_id = ${orgId}
      RETURNING user_id, org_id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Membership not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User removed from organization',
    });
  } catch (error: any) {
    console.error('Error removing user from org:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove user from org' },
      { status: 500 }
    );
  }
}
