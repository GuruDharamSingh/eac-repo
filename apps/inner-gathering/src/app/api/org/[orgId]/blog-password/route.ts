import { NextResponse } from 'next/server';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';
import { getOrgRole, hasOrgRole } from '@elkdonis/services';
import { createHash, randomBytes } from 'crypto';

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(password + salt).digest('hex');
}

async function isOwnerOrGuideOrAdmin(userId: string, orgId: string): Promise<boolean> {
  if (await hasOrgRole(userId, orgId, ['owner', 'guide'])) return true;
  return isAdmin(userId);
}

/**
 * GET /api/org/[orgId]/blog-password
 * Check if a blog password is set for this org, and whether the current user needs one.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

    // Check if org exists and has a password set
    const [org] = await db`
      SELECT id, name, blog_password_hash IS NOT NULL as has_password
      FROM organizations
      WHERE id = ${orgId}
    `;

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const [role, isOwnerOrGuide] = await Promise.all([
      getOrgRole(session.user.id, orgId),
      isOwnerOrGuideOrAdmin(session.user.id, orgId),
    ]);

    return NextResponse.json({
      orgId: org.id,
      orgName: org.name,
      hasPassword: org.has_password,
      userRole: role,
      isOwnerOrGuide,
      needsPassword: !isOwnerOrGuide && org.has_password,
    });
  } catch (error: any) {
    console.error('Error checking blog password:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check blog password' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/org/[orgId]/blog-password
 * Set or update the blog password for an org. Only owner/guide/admin can do this.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

    if (!(await isOwnerOrGuideOrAdmin(session.user.id, orgId))) {
      return NextResponse.json(
        { error: 'Only organization owners, guides, or admins can set the blog password' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== 'string' || password.length < 4) {
      return NextResponse.json(
        { error: 'Password must be at least 4 characters' },
        { status: 400 }
      );
    }

    // Generate salt and hash password
    const salt = randomBytes(32).toString('hex');
    const hash = hashPassword(password, salt);

    await db`
      UPDATE organizations
      SET blog_password_hash = ${hash}, blog_password_salt = ${salt}
      WHERE id = ${orgId}
    `;

    return NextResponse.json({ success: true, message: 'Blog password updated' });
  } catch (error: any) {
    console.error('Error setting blog password:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to set blog password' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/org/[orgId]/blog-password
 * Remove the blog password (makes org open for anyone to post to).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

    if (!(await isOwnerOrGuideOrAdmin(session.user.id, orgId))) {
      return NextResponse.json(
        { error: 'Only organization owners, guides, or admins can remove the blog password' },
        { status: 403 }
      );
    }

    await db`
      UPDATE organizations
      SET blog_password_hash = NULL, blog_password_salt = NULL
      WHERE id = ${orgId}
    `;

    return NextResponse.json({ success: true, message: 'Blog password removed' });
  } catch (error: any) {
    console.error('Error removing blog password:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove blog password' },
      { status: 500 }
    );
  }
}
