import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

const ORG_ID = 'amrit_canada';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { meeting_id, name, email, phone, message, wants_reminder } = body;

    if (!meeting_id || !name?.trim()) {
      return NextResponse.json({ error: 'meeting_id and name are required' }, { status: 400 });
    }

    // Confirm meeting exists and is published
    const [meeting] = await db<{ id: string; title: string }[]>`
      SELECT id, title FROM meetings
      WHERE id = ${meeting_id} AND org_id = ${ORG_ID} AND status = 'published'
      LIMIT 1
    `;
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const id = nanoid();

    await db`
      INSERT INTO rsvp_responses (id, meeting_id, org_id, name, email, phone, message, wants_reminder)
      VALUES (
        ${id},
        ${meeting_id},
        ${ORG_ID},
        ${name.trim()},
        ${email?.trim() || null},
        ${phone?.trim() || null},
        ${message?.trim() || null},
        ${wants_reminder ?? false}
      )
    `;

    // Upsert into contacts if email provided, so admin can see them
    if (email?.trim()) {
      const contactId = nanoid();
      await db`
        INSERT INTO contacts (id, org_id, email, name, message, status, source)
        VALUES (
          ${contactId},
          ${ORG_ID},
          ${email.trim()},
          ${name.trim()},
          ${message?.trim() || null},
          'new',
          'rsvp'
        )
        ON CONFLICT DO NOTHING
      `;
    }

    const [{ count }] = await db<{ count: string }[]>`
      SELECT COUNT(*) as count FROM rsvp_responses WHERE meeting_id = ${meeting_id}
    `;

    return NextResponse.json({ ok: true, rsvp_count: parseInt(count, 10) });
  } catch (err) {
    console.error('[amrit-canada] POST /api/rsvp error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
