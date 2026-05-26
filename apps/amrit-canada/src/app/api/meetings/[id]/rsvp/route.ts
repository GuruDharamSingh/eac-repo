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
    const [meeting] = await db`
      SELECT
        t.id, t.title, t.is_rsvp_enabled, t.scheduled_at, t.section,
        t.author_id AS guide_id,
        u.email AS guide_email,
        COALESCE(u.display_name, u.email) AS guide_name
      FROM threads t
      LEFT JOIN users u ON u.id = t.author_id
      WHERE t.kind = 'meeting' AND t.id = ${meetingId} AND t.status = 'published'
      LIMIT 1
    `;

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const existing = await db`
      SELECT thread_id FROM thread_rsvps
      WHERE thread_id = ${meetingId} AND user_id = ${userId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json({ status: 'already_attending' });
    }

    await db`
      INSERT INTO thread_rsvps (thread_id, user_id, status)
      VALUES (${meetingId}, ${userId}, 'yes')
    `;

    // Look up the attendee's display info
    const [attendee] = await db`
      SELECT COALESCE(display_name, email) AS name, email
      FROM users WHERE id = ${userId}
    `;

    const [{ count }] = await db`
      SELECT COUNT(*) as count FROM thread_rsvps
      WHERE thread_id = ${meetingId} AND status = 'yes'
    `;

    // Notify guide non-blocking
    void (async () => {
      try {
        const { sendRsvpNotification } = await import('@elkdonis/email');
        const guideEmail = meeting.guide_email as string | null;
        if (!guideEmail) return;

        await sendRsvpNotification(guideEmail, {
          guestName: (attendee?.name as string) ?? 'A member',
          guestEmail: (attendee?.email as string) ?? undefined,
          meetingTitle: meeting.title as string,
          section: meeting.section ? String(meeting.section) : undefined,
          scheduledAt: meeting.scheduled_at ? String(meeting.scheduled_at) : undefined,
          orgName: 'Amrit Canada',
          rsvpCount: parseInt(count as string, 10),
        });
      } catch (emailErr) {
        console.error('[amrit-canada] auth rsvp email failed:', emailErr);
      }
    })();

    return NextResponse.json({ status: 'attending' });
  } catch (err) {
    console.error('[amrit-canada] RSVP error:', err);
    return NextResponse.json({ error: 'Failed to RSVP' }, { status: 500 });
  }
}
