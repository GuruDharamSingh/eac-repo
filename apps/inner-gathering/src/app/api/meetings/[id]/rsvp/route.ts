import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";

// GET - Check if current user is attending
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ attending: false, status: null });
    }

    const result = await db`
      SELECT attendance_status, registered_at
      FROM meeting_attendees
      WHERE meeting_id = ${meetingId} AND user_id = ${session.user.id}
    `;

    if (result.length === 0) {
      return NextResponse.json({ attending: false, status: null });
    }

    return NextResponse.json({
      attending: true,
      status: result[0].attendance_status,
      registeredAt: result[0].registered_at,
    });
  } catch (error) {
    console.error("Error checking RSVP status:", error);
    return NextResponse.json(
      { error: "Failed to check attendance status" },
      { status: 500 }
    );
  }
}

// POST - Register attendance (RSVP)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Must be logged in to RSVP" },
        { status: 401 }
      );
    }

    // Check if meeting exists and has RSVP enabled
    const meeting = await db`
      SELECT id, title, is_rsvp_enabled, attendee_limit, scheduled_at, rsvp_deadline,
             min_attendees, notify_on_min_attendees, min_attendees_notified, guide_id
      FROM meetings
      WHERE id = ${meetingId}
    `;

    if (meeting.length === 0) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    if (!meeting[0].is_rsvp_enabled) {
      return NextResponse.json(
        { error: "RSVP is not enabled for this meeting" },
        { status: 400 }
      );
    }

    // Check RSVP deadline
    if (meeting[0].rsvp_deadline && new Date(meeting[0].rsvp_deadline) < new Date()) {
      return NextResponse.json(
        { error: "RSVP deadline has passed" },
        { status: 400 }
      );
    }

    // Check attendee limit
    if (meeting[0].attendee_limit) {
      const countResult = await db`
        SELECT COUNT(*) as count FROM meeting_attendees WHERE meeting_id = ${meetingId}
      `;
      if (parseInt(countResult[0].count) >= meeting[0].attendee_limit) {
        return NextResponse.json(
          { error: "Meeting is at capacity" },
          { status: 400 }
        );
      }
    }

    // Insert or update attendance record
    await db`
      INSERT INTO meeting_attendees (meeting_id, user_id, attendance_status, registered_at)
      VALUES (${meetingId}, ${session.user.id}, 'registered', NOW())
      ON CONFLICT (meeting_id, user_id)
      DO UPDATE SET attendance_status = 'registered', registered_at = NOW()
    `;

    // Check if minimum attendees threshold reached and trigger notification
    let minAttendeesReached = false;
    if (
      meeting[0].min_attendees &&
      meeting[0].notify_on_min_attendees &&
      !meeting[0].min_attendees_notified
    ) {
      const countResult = await db`
        SELECT COUNT(*) as count FROM meeting_attendees WHERE meeting_id = ${meetingId}
      `;
      const currentCount = parseInt(countResult[0].count);

      if (currentCount >= meeting[0].min_attendees) {
        minAttendeesReached = true;

        // Mark as notified to prevent duplicate notifications
        await db`
          UPDATE meetings SET min_attendees_notified = true WHERE id = ${meetingId}
        `;

        // Create notification for the meeting organizer
        await db`
          INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
          VALUES (
            ${`notif_${Date.now()}_${Math.random().toString(36).substring(7)}`},
            ${meeting[0].guide_id},
            'meeting_min_attendees',
            'Minimum attendees reached!',
            ${`Your meeting "${meeting[0].title}" has reached the minimum of ${meeting[0].min_attendees} attendees.`},
            ${JSON.stringify({ meetingId, attendeeCount: currentCount })},
            NOW()
          )
        `;

        console.log(`✓ Minimum attendees notification sent for meeting ${meetingId}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      status: "registered",
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Must be logged in" },
        { status: 401 }
      );
    }

    await db`
      DELETE FROM meeting_attendees
      WHERE meeting_id = ${meetingId} AND user_id = ${session.user.id}
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
