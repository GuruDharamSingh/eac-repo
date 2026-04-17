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
      SELECT id, title, is_rsvp_enabled, attendee_limit, scheduled_at, rsvp_deadline,
             min_attendees, notify_on_min_attendees, min_attendees_notified,
             author_id AS guide_id
      FROM threads
      WHERE kind = 'meeting' AND id = ${threadId}
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

    // Min-attendees threshold + one-shot notification
    let minAttendeesReached = false;
    if (
      meeting[0].min_attendees &&
      meeting[0].notify_on_min_attendees &&
      !meeting[0].min_attendees_notified
    ) {
      const countResult = await db`
        SELECT COUNT(*) as count FROM thread_rsvps
        WHERE thread_id = ${threadId} AND status = 'yes'
      `;
      const currentCount = parseInt(countResult[0].count);

      if (currentCount >= meeting[0].min_attendees) {
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

        console.log(`✓ Minimum attendees notification sent for thread ${threadId}`);
      }
    }

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
