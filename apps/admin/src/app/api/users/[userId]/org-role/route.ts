import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';
import { listUserMemberships, setOrgRole, removeOrgMember, type OrgRole } from '@elkdonis/services';

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
    const memberships = await listUserMemberships(userId);

    return NextResponse.json({
      memberships: memberships.map((m) => ({
        org_id: m.orgId,
        role: m.role,
        joined_at: m.joinedAt,
        org_name: m.orgName,
      })),
    });
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

    const validRoles: OrgRole[] = ['guide', 'member', 'viewer'];
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

    const membership = await setOrgRole(userId, orgId, role);

    return NextResponse.json({
      success: true,
      membership,
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

    const removed = await removeOrgMember(userId, orgId);
    if (!removed) {
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
