import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { siteConfig } from "@/config/site";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventId = String(body.event_id || "").trim() || null;
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const status = String(body.status || "yes").trim();
    const message = String(body.message || "").trim();

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    let validEventId: string | null = null;
    let eventTitle = "IFAC Event";
    let eventScheduledAt: string | null = null;

    if (eventId) {
      const [event] = await db<{ id: string; title: string; scheduled_at: string | null }[]>`
        SELECT id, title, scheduled_at FROM threads
        WHERE id = ${eventId}
          AND org_id = ${siteConfig.orgId}
          AND kind IN ('event', 'meeting', 'workshop')
          AND status = 'published'
        LIMIT 1
      `;
      if (event) {
        validEventId = event.id;
        eventTitle = event.title;
        eventScheduledAt = event.scheduled_at;
      }
    }

    await db`
      INSERT INTO guest_submissions (id, thread_id, kind, name, email, message, metadata)
      VALUES (
        ${nanoid()},
        ${validEventId},
        'rsvp',
        ${name},
        ${email},
        ${[message, `Status: ${status}`].filter(Boolean).join("\n") || null},
        ${db.json({ phone: phone || null, wants_reminder: true })}
      )
    `;

    await db`
      INSERT INTO contacts (id, org_id, email, name, message, status, source)
      VALUES (${nanoid()}, ${siteConfig.orgId}, ${email}, ${name}, ${message || null}, 'new', 'ifac_rsvp')
      ON CONFLICT DO NOTHING
    `;

    // Fire emails non-blocking
    void (async () => {
      try {
        const { sendRsvpConfirmation, sendRsvpNotification } = await import("@elkdonis/email");
        const ownerEmail =
          process.env.NEXT_PUBLIC_IFAC_OWNER_EMAIL ?? "info@ifacgroup.com";

        await Promise.all([
          sendRsvpConfirmation(email, {
            guestName: name,
            meetingTitle: eventTitle,
            scheduledAt: eventScheduledAt ?? undefined,
            orgName: siteConfig.orgName,
            primaryColor: "#8B6914",
          }),
          sendRsvpNotification(ownerEmail, {
            guestName: name,
            guestEmail: email,
            guestPhone: phone || undefined,
            guestMessage: message || undefined,
            meetingTitle: eventTitle,
            scheduledAt: eventScheduledAt ?? undefined,
            orgName: siteConfig.orgName,
          }),
        ]);
      } catch (emailErr) {
        console.error("[ifac] rsvp email failed:", emailErr);
      }
    })();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ifac] rsvp error:", error);
    return NextResponse.json({ error: "Could not submit RSVP." }, { status: 500 });
  }
}
