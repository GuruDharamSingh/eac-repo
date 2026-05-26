import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";

// ============================================================================
// RSVP via thread_rsvps (meeting_attendees table was dropped in migration 030).
// thread_rsvps.status is 'yes' | 'no' | 'maybe' | 'waitlist' — no separate
// attended/absent tracking. "Registered" == status 'yes'.
// ============================================================================

// GET - Check if current user has RSVP'd yes
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ attending: false, status: null });
    }

    const result = await db`
      SELECT status, created_at
      FROM thread_rsvps
      WHERE thread_id = ${threadId} AND user_id = ${session.user.id}
    `;

    if (result.length === 0) {
      return NextResponse.json({ attending: false, status: null });
    }

    return NextResponse.json({
      attending: result[0].status === 'yes',
      status: result[0].status,
      registeredAt: result[0].created_at,
    });
  } catch (error) {
    console.error("Error checking RSVP status:", error);
    return NextResponse.json(
      { error: "Failed to check attendance status" },
      { status: 500 }
    );
  }
}

// POST - Register attendance (RSVP 'yes')
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Must be logged in to RSVP" },
        { status: 401 }
      );
    }

    const meeting = await db`
      SELECT
        t.id, t.title, t.is_rsvp_enabled, t.attendee_limit, t.scheduled_at,
        t.rsvp_deadline, t.min_attendees, t.notify_on_min_attendees,
        t.min_attendees_notified, t.author_id AS guide_id,
        u.email AS guide_email,
        COALESCE(u.display_name, u.email) AS guide_name
      FROM threads t
      LEFT JOIN users u ON u.id = t.author_id
      WHERE t.kind = 'meeting' AND t.id = ${threadId}
    `;

    if (meeting.length === 0) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (!meeting[0].is_rsvp_enabled) {
      return NextResponse.json(
        { error: "RSVP is not enabled for this meeting" },
        { status: 400 }
      );
    }

    if (meeting[0].rsvp_deadline && new Date(meeting[0].rsvp_deadline) < new Date()) {
      return NextResponse.json(
        { error: "RSVP deadline has passed" },
        { status: 400 }
      );
    }

    if (meeting[0].attendee_limit) {
      const countResult = await db`
        SELECT COUNT(*) as count FROM thread_rsvps
        WHERE thread_id = ${threadId} AND status = 'yes'
      `;
      if (parseInt(countResult[0].count) >= meeting[0].attendee_limit) {
        return NextResponse.json(
          { error: "Meeting is at capacity" },
          { status: 400 }
        );
      }
    }

    await db`
      INSERT INTO thread_rsvps (thread_id, user_id, status)
      VALUES (${threadId}, ${session.user.id}, 'yes')
      ON CONFLICT (thread_id, user_id)
      DO UPDATE SET status = 'yes', updated_at = NOW()
    `;

    // Count RSVPs for threshold check + email
    const countResult = await db`
      SELECT COUNT(*) as count FROM thread_rsvps
      WHERE thread_id = ${threadId} AND status = 'yes'
    `;
    const currentCount = parseInt(countResult[0].count);

    // Min-attendees threshold — one-shot notification
    let minAttendeesReached = false;
    if (
      meeting[0].min_attendees &&
      meeting[0].notify_on_min_attendees &&
      !meeting[0].min_attendees_notified &&
      currentCount >= meeting[0].min_attendees
    ) {
      minAttendeesReached = true;

      await db`
        UPDATE threads SET min_attendees_notified = true
        WHERE id = ${threadId} AND kind = 'meeting'
      `;

      await db`
        INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
        VALUES (
          ${`notif_${Date.now()}_${Math.random().toString(36).substring(7)}`},
          ${meeting[0].guide_id},
          'meeting_min_attendees',
          'Minimum attendees reached!',
          ${`Your meeting "${meeting[0].title}" has reached the minimum of ${meeting[0].min_attendees} attendees.`},
          ${JSON.stringify({ threadId, attendeeCount: currentCount })},
          NOW()
        )
      `;
    }

    // Get the RSVP'ing user's display info for email
    const [attendee] = await db`
      SELECT COALESCE(display_name, email) AS name, email
      FROM users WHERE id = ${session.user.id}
    `;

    // Fire emails non-blocking
    void (async () => {
      try {
        const { sendRsvpNotification } = await import('@elkdonis/email');
        const guideEmail = meeting[0].guide_email as string | null;
        if (!guideEmail) return;

        const emailData = {
          guestName: (attendee?.name as string) ?? 'A member',
          guestEmail: (attendee?.email as string) ?? undefined,
          meetingTitle: meeting[0].title as string,
          scheduledAt: meeting[0].scheduled_at ? String(meeting[0].scheduled_at) : undefined,
          orgName: 'Inner Gathering',
          rsvpCount: currentCount,
        };

        const sends: Promise<void>[] = [sendRsvpNotification(guideEmail, emailData)];

        if (minAttendeesReached) {
          // Second email — explicitly flag the milestone
          sends.push(
            sendRsvpNotification(guideEmail, {
              ...emailData,
              guestMessage: `Minimum attendees threshold of ${meeting[0].min_attendees} has been reached!`,
            })
          );
        }

        await Promise.all(sends);
      } catch (emailErr) {
        console.error('[inner-gathering] rsvp email failed:', emailErr);
      }
    })();

    return NextResponse.json({
      success: true,
      status: "yes",
      minAttendeesReached,
    });
  } catch (error) {
    console.error("Error registering RSVP:", error);
    return NextResponse.json(
      { error: "Failed to register attendance" },
      { status: 500 }
    );
  }
}

// DELETE - Cancel attendance
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Must be logged in" }, { status: 401 });
    }

    await db`
      DELETE FROM thread_rsvps
      WHERE thread_id = ${threadId} AND user_id = ${session.user.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error canceling RSVP:", error);
    return NextResponse.json(
      { error: "Failed to cancel attendance" },
      { status: 500 }
    );
  }
}
