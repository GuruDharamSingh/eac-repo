import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { sendRsvpConfirmation, sendRsvpNotification } from "@elkdonis/email";
import { siteConfig } from "@/config/site";

/**
 * Guest RSVP — no account required.
 *
 * This exists because most people who show up to 4am sadhana will never make
 * an account, and requiring one would both undercount the room and gatekeep a
 * public practice. Signed-in members use /api/threads/[id]/rsvp instead, which
 * gives them a durable record on /account.
 *
 * Writes to `guest_submissions` (the RSVP itself) and upserts `contacts` (the
 * mailing list). Both counts are combined for display — see getAttendanceCount.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // `meeting_id` is the pre-rebuild field name; accepted so any older link
    // or embedded form still works.
    const threadId: string | undefined = body.threadId ?? body.meeting_id;
    const name: string = (body.name ?? "").trim();
    const email: string = (body.email ?? "").trim();
    const phone: string = (body.phone ?? "").trim();
    const message: string = (body.message ?? "").trim();
    const wantsReminder: boolean = body.wantsReminder ?? body.wants_reminder ?? false;

    if (!threadId || !name) {
      return NextResponse.json({ error: "A name and the gathering are required." }, { status: 400 });
    }

    // Any RSVP-enabled thread kind, not just 'meeting' — a workshop or a
    // one-off event takes guests on the same terms.
    const [thread] = await db<
      {
        id: string;
        title: string;
        slug: string;
        section: string | null;
        scheduled_at: Date | null;
        is_rsvp_enabled: boolean;
        rsvp_deadline: Date | null;
        author_email: string | null;
      }[]
    >`
      SELECT t.id, t.title, t.slug, t.section, t.scheduled_at,
             t.is_rsvp_enabled, t.rsvp_deadline, u.email AS author_email
      FROM threads t
      LEFT JOIN users u ON u.id = t.author_id
      WHERE t.id = ${threadId}
        AND t.org_id = ${siteConfig.orgId}
        AND t.status = 'published'
      LIMIT 1
    `;

    if (!thread) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!thread.is_rsvp_enabled) {
      return NextResponse.json({ error: "RSVPs are not open for this." }, { status: 409 });
    }
    if (thread.rsvp_deadline && new Date(thread.rsvp_deadline) < new Date()) {
      return NextResponse.json({ error: "The RSVP deadline has passed." }, { status: 409 });
    }

    await db`
      INSERT INTO guest_submissions (id, thread_id, kind, name, email, message, metadata)
      VALUES (
        ${nanoid()}, ${thread.id}, 'rsvp', ${name}, ${email || null}, ${message || null},
        ${db.json({ phone: phone || null, wants_reminder: wantsReminder })}
      )
    `;

    if (email) {
      await db`
        INSERT INTO contacts (id, org_id, email, name, message, status, source)
        VALUES (${nanoid()}, ${siteConfig.orgId}, ${email}, ${name}, ${message || null}, 'new', 'rsvp')
        ON CONFLICT DO NOTHING
      `;
    }

    const [{ count }] = await db<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM guest_submissions
      WHERE thread_id = ${thread.id} AND kind = 'rsvp'
    `;

    const threadUrl = thread.section
      ? `${request.nextUrl.origin}/${thread.section}/${thread.slug}`
      : request.nextUrl.origin;

    // Non-blocking: an email failure must never cost someone their RSVP.
    void (async () => {
      const scheduledAt = thread.scheduled_at?.toISOString();
      try {
        if (email) {
          await sendRsvpConfirmation(email, {
            guestName: name,
            meetingTitle: thread.title,
            section: thread.section ?? undefined,
            scheduledAt,
            orgName: siteConfig.orgName,
          });
        }
      } catch (err) {
        console.error("[innergathering] guest confirmation email:", err);
      }

      try {
        const notifyTo = thread.author_email ?? siteConfig.fallbackNotifyEmail;
        if (notifyTo) {
          await sendRsvpNotification(notifyTo, {
            guestName: name,
            guestEmail: email || undefined,
            guestPhone: phone || undefined,
            guestMessage: message || undefined,
            wantsReminder,
            meetingTitle: thread.title,
            section: thread.section ?? undefined,
            scheduledAt,
            threadUrl,
            orgName: siteConfig.orgName,
            rsvpCount: count,
          });
        }
      } catch (err) {
        console.error("[innergathering] guest owner notification:", err);
      }
    })();

    return NextResponse.json({ ok: true, rsvpCount: count });
  } catch (err) {
    console.error("[innergathering] POST /api/rsvp:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
