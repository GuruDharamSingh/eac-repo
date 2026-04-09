import { NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';
import { createHash } from 'crypto';

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(password + salt).digest('hex');
}

/**
 * POST /api/org/[orgId]/blog-password/verify
 * Verify a blog password for a non-owner user trying to post to this org.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Get org password hash and salt
    const [org] = await db`
      SELECT blog_password_hash, blog_password_salt
      FROM organizations
      WHERE id = ${orgId}
    `;

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!org.blog_password_hash || !org.blog_password_salt) {
      // No password set — anyone can post
      return NextResponse.json({ valid: true });
    }

    const hash = hashPassword(password, org.blog_password_salt);
    const valid = hash === org.blog_password_hash;

    return NextResponse.json({ valid });
  } catch (error: any) {
    console.error('Error verifying blog password:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify password' },
      { status: 500 }
    );
  }
}
