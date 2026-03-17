import { NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

/**
 * GET /api/meetings
 * Returns all meetings including workshop promotion columns.
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

    const meetings = await db`
      SELECT
        m.id,
        m.title,
        m.description,
        m.scheduled_at,
        m.location,
        m.is_online,
        m.org_id,
        m.status,
        m.meeting_url,
        m.attendee_limit,
        m.show_on_workshops_page,
        m.workshop_order,
        m.subtitle,
        m.card_colour,
        m.card_accent_colour,
        m.metadata,
        m.created_at
      FROM meetings m
      ORDER BY
        m.show_on_workshops_page DESC,
        m.workshop_order ASC NULLS LAST,
        m.scheduled_at DESC NULLS LAST
      LIMIT 100
    `;

    return NextResponse.json({ meetings });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch meetings';
    console.error('Error fetching meetings:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
