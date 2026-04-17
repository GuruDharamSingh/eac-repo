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
      SELECT id, is_rsvp_enabled FROM threads
      WHERE kind = 'meeting' AND id = ${meetingId} AND status = 'published'
      LIMIT 1
    `;

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Upsert RSVP via thread_rsvps
    const existing = await db`
      SELECT thread_id FROM thread_rsvps
      WHERE thread_id = ${meetingId}
        AND user_id = ${userId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json({ status: 'already_attending' });
    }

    await db`
      INSERT INTO thread_rsvps (thread_id, user_id, status)
      VALUES (${meetingId}, ${userId}, 'yes')
    `;

    return NextResponse.json({ status: 'attending' });
  } catch (err) {
    console.error('[amrit-canada] RSVP error:', err);
    return NextResponse.json({ error: 'Failed to RSVP' }, { status: 500 });
  }
}
