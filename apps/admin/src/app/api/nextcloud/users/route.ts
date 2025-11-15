import { NextResponse } from 'next/server';
import { db } from '@elkdonis/db';

export async function GET() {
  try {
    const users = await db`
      SELECT
        id,
        email,
        display_name,
        nextcloud_user_id,
        nextcloud_synced
      FROM users
      ORDER BY email
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
