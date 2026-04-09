import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { getServerSession } from '@elkdonis/auth-server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to RSVP' }, { status: 401 });
  }

  const { id: meetingId } = await params;
  const userId = session.user.db_user_id ?? session.user.id;

  try {
    // Check meeting exists and RSVP is enabled
    const [meeting] = await db`
      SELECT id, is_rsvp_enabled FROM meetings
      WHERE id = ${meetingId} AND status = 'published'
      LIMIT 1
    `;

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Upsert RSVP as a reply with parent_type='meeting'
    const existing = await db`
      SELECT id FROM replies
      WHERE parent_id = ${meetingId}
        AND parent_type = 'meeting'
        AND user_id = ${userId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json({ status: 'already_attending' });
    }

    await db`
      INSERT INTO replies (id, parent_id, parent_type, user_id, content)
      VALUES (${nanoid()}, ${meetingId}, 'meeting', ${userId}, 'attending')
    `;

    return NextResponse.json({ status: 'attending' });
  } catch (err) {
    console.error('[amrit-canada] RSVP error:', err);
    return NextResponse.json({ error: 'Failed to RSVP' }, { status: 500 });
  }
}
