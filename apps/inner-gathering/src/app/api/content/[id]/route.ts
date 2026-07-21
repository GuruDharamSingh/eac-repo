import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@elkdonis/db";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";
import { lastOccurrenceEnd } from "@/lib/recurrence";
import {
  RSVP_GUEST_TEMPLATE_KEY,
  getEmailTemplateSettings,
  threadTemplateKey,
} from "@/lib/email-template-settings";

const ORG_ID = "inner_group";

// Guides allowed to confirm/cancel a meeting cycle: the author + any co-guides
// listed in metadata.coGuideIds.
function meetingGuideIds(thread: any): string[] {
  const coGuides = Array.isArray(thread.metadata?.coGuideIds) ? thread.metadata.coGuideIds : [];
  return Array.from(new Set<string>([thread.author_id, ...coGuides]));
}

// GET /api/content/[id] — full editable draft for the content form.
// Returns the thread's stored kind plus a ContentDraft-shaped object,
// including workshop details/sessions so an edit round-trip doesn't wipe them.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [thread] = await db`
      SELECT id, kind, org_id, author_id, title, body, status, visibility,
             scheduled_at, duration_minutes, location, is_online, is_meeting,
             video_link, meeting_url,
             recurrence_pattern, recurrence_custom_rule, recurrence_until,
             is_rsvp_enabled, attendee_limit, rsvp_deadline, min_attendees,
             reminder_minutes_before,
             published_at, document_url
      FROM threads
      WHERE id = ${id}
      LIMIT 1
    `;
    // No org filter: My Offerings edits span all orgs the author publishes
    // in — access is enforced by the author/admin check below.

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const admin = await isAdmin(session.user.id);
    if (thread.author_id !== session.user.id && !admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let pitch: string | null = null;
    let price: number | null = null;
    let flyerUrl: string | null = null;
    let sessions: Array<{
      id: string;
      title: string;
      description?: string;
      scheduledAt?: string;
      durationMinutes?: number;
      isOnline?: boolean;
      location?: string;
      videoConferenceUrl?: string;
      mediaUrl?: string | null;
      orderIndex: number;
    }> = [];

    if (thread.kind === "workshop") {
      const [page] = await db`
        SELECT description_short, price_member, cover_image_url
        FROM workshop_pages WHERE thread_id = ${id}
      `;
      if (page) {
        pitch = (page.description_short as string) ?? null;
        price = page.price_member != null ? Number(page.price_member) : null;
        flyerUrl = (page.cover_image_url as string) ?? null;
      }
      const sessionRows = await db`
        SELECT id, session_number, topic, scheduled_at, duration_minutes, notes
        FROM workshop_sessions
        WHERE thread_id = ${id}
        ORDER BY session_number
      `;
      sessions = sessionRows.map((s: any) => ({
        id: s.id,
        title: s.topic ?? "",
        description: s.notes?.description ?? "",
        scheduledAt: s.scheduled_at ? new Date(s.scheduled_at).toISOString() : undefined,
        durationMinutes: s.duration_minutes ?? undefined,
        isOnline: s.notes?.isOnline ?? true,
        location: s.notes?.location ?? "",
        videoConferenceUrl: s.notes?.videoConferenceUrl ?? "",
        mediaUrl: s.notes?.mediaUrl ?? null,
        orderIndex: (s.session_number ?? 1) - 1,
      }));
    }

    // Thread-scoped RSVP confirmation copy (empty when using the org default)
    const rsvpTemplate = thread.is_rsvp_enabled
      ? await getEmailTemplateSettings(
          thread.org_id,
          threadTemplateKey(RSVP_GUEST_TEMPLATE_KEY, id)
        ).catch(() => null)
      : null;

    return NextResponse.json({
      id: thread.id,
      kind: thread.kind,
      draft: {
        title: thread.title,
        body: thread.body ?? "",
        publishAt: thread.status === "scheduled" && thread.published_at
          ? new Date(thread.published_at).toISOString()
          : null,
        isMeeting: thread.is_meeting ?? false,
        scheduledAt: thread.scheduled_at ? new Date(thread.scheduled_at).toISOString() : null,
        durationMinutes: thread.duration_minutes ?? null,
        location: thread.location ?? null,
        isOnline: thread.is_online ?? false,
        videoLink: thread.video_link ?? thread.meeting_url ?? null,
        recurrencePattern: thread.recurrence_pattern ?? "NONE",
        recurrenceCustomRule: thread.recurrence_custom_rule ?? null,
        recurrenceUntil: thread.recurrence_until
          ? new Date(thread.recurrence_until).toISOString()
          : null,
        isRsvpEnabled: thread.is_rsvp_enabled ?? false,
        attendeeLimit: thread.attendee_limit ?? null,
        rsvpDeadline: thread.rsvp_deadline ? new Date(thread.rsvp_deadline).toISOString() : null,
        minAttendees: thread.min_attendees ?? null,
        reminderMinutesBefore: thread.reminder_minutes_before ?? 60,
        rsvpEmailBody: rsvpTemplate?.config.bodyText ?? null,
        pitch,
        price,
        flyerUrl,
        sessions,
        visibility: thread.visibility ?? "PUBLIC",
        primaryOrgId: thread.org_id,
      },
    });
  } catch (error) {
    console.error("Failed to load content draft:", error);
    return NextResponse.json(
      { error: "Failed to load content" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await isAdmin(session.user.id);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [thread] = await db`
      SELECT id
      FROM threads
      WHERE id = ${id}
        AND org_id = ${ORG_ID}
      LIMIT 1
    `;

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    await db`
      UPDATE threads
      SET status = 'archived', updated_at = NOW()
      WHERE id = ${id}
        AND org_id = ${ORG_ID}
    `;

    revalidatePath("/feed");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete post:", error);
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const admin = await isAdmin(userId);
    const body = await request.json();

    // feedPinned: admin-only
    if (typeof body.feedPinned === "boolean") {
      if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const [thread] = await db`
        UPDATE threads
        SET metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{feedPinned}',
              ${JSON.stringify(body.feedPinned)}::jsonb,
              true
            ),
            updated_at = NOW()
        WHERE id = ${id}
          AND org_id = ${ORG_ID}
          AND kind IN ('meeting', 'post', 'workshop', 'event')
        RETURNING id, metadata
      `;

      if (!thread) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 });
      }

      revalidatePath("/feed");
      return NextResponse.json({ success: true, id: thread.id, metadata: thread.metadata });
    }

    // Cycle confirm/cancel: a guide greenlights or calls off the current
    // occurrence. Accepts { action: 'confirmed' | 'cancelled' }.
    if (body.action === "confirmed" || body.action === "cancelled") {
      const action = body.action as "confirmed" | "cancelled";

      const [meeting] = await db`
        SELECT id, title, author_id, metadata, scheduled_at,
               recurrence_pattern, duration_minutes
        FROM threads
        WHERE id = ${id} AND org_id = ${ORG_ID} AND kind IN ('meeting', 'workshop')
        LIMIT 1
      `;

      if (!meeting) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 });
      }

      const guideIds = meetingGuideIds(meeting);
      if (!admin && !guideIds.includes(userId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Record the event (powers the badge + per-cycle analytics)
      await db`
        INSERT INTO thread_cycle_events (id, thread_id, user_id, action)
        VALUES (${`cyc_${nanoid(16)}`}, ${id}, ${userId}, ${action})
      `;

      // Cancellation notifications. Confirmations need none — the badge says it all.
      if (action === "cancelled") {
        const cutoff = meeting.scheduled_at
          ? lastOccurrenceEnd(
              new Date(meeting.scheduled_at),
              meeting.recurrence_pattern,
              meeting.duration_minutes
            )
          : null;

        // Did any OTHER guide confirm this cycle? If so the meeting still
        // happens — only that guide is told. Otherwise RSVPs hear it's off.
        const [{ count: otherGuideConfirms }] = await db`
          SELECT COUNT(*)::int AS count
          FROM thread_cycle_events e
          WHERE e.thread_id = ${id}
            AND e.action = 'confirmed'
            AND e.user_id <> ${userId}
            AND e.user_id = ANY(${guideIds})
            ${cutoff ? db`AND e.created_at > ${cutoff}` : db``}
        `;

        // Always notify the other guides in-app so they can step in.
        const otherGuides = guideIds.filter((g) => g !== userId);
        for (const guideId of otherGuides) {
          await db`
            INSERT INTO notifications (id, user_id, kind, thread_id, actor_id, data)
            VALUES (
              ${`ntf_${nanoid(16)}`}, ${guideId}, 'meeting_cancelled', ${id}, ${userId},
              ${JSON.stringify({ title: meeting.title, role: "guide" })}::jsonb
            )
          `;
        }

        // No other guide is covering → tell everyone who RSVP'd, in-app + email.
        if (otherGuideConfirms === 0) {
          const rsvps = await db`
            SELECT r.user_id, u.email, COALESCE(u.display_name, u.email) AS name
            FROM thread_rsvps r
            JOIN users u ON u.id = r.user_id
            WHERE r.thread_id = ${id} AND r.status = 'yes'
          `;

          for (const r of rsvps) {
            await db`
              INSERT INTO notifications (id, user_id, kind, thread_id, actor_id, data)
              VALUES (
                ${`ntf_${nanoid(16)}`}, ${r.user_id}, 'meeting_cancelled', ${id}, ${userId},
                ${JSON.stringify({ title: meeting.title, role: "attendee" })}::jsonb
              )
            `;
          }

          // Fire emails non-blocking
          const recipients = rsvps.filter((r: any) => r.email).map((r: any) => ({ email: r.email as string, name: r.name as string }));
          if (recipients.length > 0) {
            void (async () => {
              try {
                const { sendEmail } = await import("@elkdonis/email");
                const when = meeting.scheduled_at
                  ? new Date(meeting.scheduled_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
                  : "the scheduled time";
                await Promise.all(
                  recipients.map((rcpt) =>
                    sendEmail({
                      to: rcpt.email,
                      subject: `Cancelled: ${meeting.title}`,
                      html: `<p>Hi ${rcpt.name},</p><p>The gathering <strong>${meeting.title}</strong> (${when}) has been cancelled for now. We'll let you know when it's confirmed again.</p><p>— Inner Gathering</p>`,
                      fromName: "Inner Gathering",
                    })
                  )
                );
              } catch (err) {
                console.error("[inner-gathering] cancellation email failed:", err);
              }
            })();
          }
        }
      }

      revalidatePath("/feed");
      return NextResponse.json({ success: true, id, action });
    }

    return NextResponse.json({ error: "No valid field to update" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update thread:", error);
    return NextResponse.json(
      { error: "Failed to update thread" },
      { status: 500 }
    );
  }
}