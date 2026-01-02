import { NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { getServerSession } from '@elkdonis/auth-server';

/**
 * GET /api/meetings
 *
 * Get all meetings (admin only)
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const meetings = await db`
      SELECT
        m.id,
        m.title,
        m.description,
        m.scheduled_at,
        m.location,
        m.org_id,
        m.created_at
      FROM meetings m
      ORDER BY m.scheduled_at DESC
      LIMIT 50
    `;

    return NextResponse.json({ meetings });
  } catch (error: any) {
    console.error('Error fetching meetings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch meetings' },
      { status: 500 }
    );
  }
}
