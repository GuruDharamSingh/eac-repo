import { NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

export async function GET() {
  try {
    // Auth check - require admin
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const users = await db`
      SELECT
        id,
        auth_user_id,
        email,
        display_name,
        nextcloud_user_id,
        nextcloud_synced,
        nextcloud_app_password,
        is_admin,
        trust_level,
        created_at,
        updated_at,
        last_seen_at
      FROM users
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
