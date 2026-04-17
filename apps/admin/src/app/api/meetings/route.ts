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
        t.id,
        t.title,
        t.body AS description,
        t.scheduled_at,
        t.location,
        t.is_online,
        t.org_id,
        t.status,
        t.meeting_url,
        t.attendee_limit,
        t.show_on_workshops_page,
        t.workshop_order,
        t.subtitle,
        t.card_colour,
        t.card_accent_colour,
        t.metadata,
        t.created_at
      FROM threads t
      WHERE t.kind = 'meeting'
      ORDER BY
        t.show_on_workshops_page DESC,
        t.workshop_order ASC NULLS LAST,
        t.scheduled_at DESC NULLS LAST
      LIMIT 100
    `;

    return NextResponse.json({ meetings });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch meetings';
    console.error('Error fetching meetings:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
