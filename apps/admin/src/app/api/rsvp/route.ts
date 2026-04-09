import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { getServerSession } from '@elkdonis/auth-server';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get('section');
  const meetingId = searchParams.get('meeting_id');

  interface RsvpRow {
    id: string;
    meeting_id: string;
    meeting_title: string;
    section: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    message: string | null;
    wants_reminder: boolean;
    created_at: string;
  }

  const rows = await db<RsvpRow[]>`
    SELECT
      r.id,
      r.meeting_id,
      m.title as meeting_title,
      m.section,
      r.name,
      r.email,
      r.phone,
      r.message,
      r.wants_reminder,
      r.created_at
    FROM rsvp_responses r
    JOIN meetings m ON m.id = r.meeting_id
    WHERE r.org_id = 'amrit_canada'
      ${section ? db`AND m.section = ${section}` : db``}
      ${meetingId ? db`AND r.meeting_id = ${meetingId}` : db``}
    ORDER BY r.created_at DESC
    LIMIT 500
  `;

  return NextResponse.json({ rsvps: rows });
}
