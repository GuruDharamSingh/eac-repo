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

    const [meeting] = await db<{ id: string; title: string; section: string | null; scheduled_at: string | null }[]>`
      SELECT id, title, section, scheduled_at FROM threads
      WHERE kind = 'meeting' AND id = ${meeting_id} AND org_id = ${ORG_ID} AND status = 'published'
      LIMIT 1
    `;
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const id = nanoid();

    await db`
      INSERT INTO guest_submissions (id, thread_id, kind, name, email, message, metadata)
      VALUES (
        ${id},
        ${meeting_id},
        'rsvp',
        ${name.trim()},
        ${email?.trim() || null},
        ${message?.trim() || null},
        ${db.json({ phone: phone?.trim() || null, wants_reminder: wants_reminder ?? false })}
      )
    `;

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
      SELECT COUNT(*) as count FROM guest_submissions
      WHERE thread_id = ${meeting_id} AND kind = 'rsvp'
    `;
    const rsvpCount = parseInt(count, 10);

    // Fire emails non-blocking — never let email failure break the RSVP
    void (async () => {
      try {
        const { sendRsvpConfirmation, sendRsvpNotification } = await import('@elkdonis/email');
        const emailData = {
          guestName: name.trim(),
          meetingTitle: meeting.title,
          section: meeting.section ?? undefined,
          scheduledAt: meeting.scheduled_at ?? undefined,
          orgName: 'Amrit Canada',
        };

        const ownerEmail = process.env.NEXT_PUBLIC_AMRIT_CANADA_OWNER_EMAIL ?? 'gurudharamsingh@gmail.com';
        await Promise.all([
          email?.trim()
            ? sendRsvpConfirmation(email.trim(), emailData)
            : Promise.resolve(),
          sendRsvpNotification(ownerEmail, {
            ...emailData,
            guestEmail: email?.trim() || undefined,
            guestPhone: phone?.trim() || undefined,
            guestMessage: message?.trim() || undefined,
            wantsReminder: wants_reminder ?? false,
            rsvpCount,
          }),
        ]);
      } catch (emailErr) {
        console.error('[amrit-canada] email send failed:', emailErr);
      }
    })();

    return NextResponse.json({ ok: true, rsvp_count: rsvpCount });
  } catch (err) {
    console.error('[amrit-canada] POST /api/rsvp error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
