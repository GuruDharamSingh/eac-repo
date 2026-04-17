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
      gs.id,
      gs.thread_id AS meeting_id,
      t.title as meeting_title,
      t.section,
      gs.name,
      gs.email,
      (gs.metadata->>'phone')::text AS phone,
      gs.message,
      COALESCE((gs.metadata->>'wants_reminder')::boolean, false) AS wants_reminder,
      gs.created_at
    FROM guest_submissions gs
    JOIN threads t ON t.id = gs.thread_id AND t.kind = 'meeting'
    WHERE t.org_id = 'amrit_canada'
      AND gs.kind = 'rsvp'
      ${section ? db`AND t.section = ${section}` : db``}
      ${meetingId ? db`AND gs.thread_id = ${meetingId}` : db``}
    ORDER BY gs.created_at DESC
    LIMIT 500
  `;

  return NextResponse.json({ rsvps: rows });
}
