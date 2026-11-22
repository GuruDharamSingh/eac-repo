import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";

// ============================================================================
// Attendees list backed by thread_rsvps.
// Migration 030 dropped meeting_attendees and its registered/attended/absent
// status vocabulary. thread_rsvps uses yes/no/maybe/waitlist. Post-meeting
// attendance tracking (PATCH to mark attended/absent) is retired here — if
// reintroduced it would live on a separate table or as metadata on the RSVP.
// ============================================================================

// GET - All RSVPs for a thread (meeting)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Must be logged in" }, { status: 401 });
    }

    const rsvps = await db`
      SELECT
        r.user_id,
        r.status,
        r.created_at AS registered_at,
        u.display_name,
        u.avatar_url
      FROM thread_rsvps r
      JOIN users u ON r.user_id = u.id
      WHERE r.thread_id = ${threadId}
      ORDER BY r.created_at ASC
    `;

    const summary: Record<string, number> = { yes: 0, no: 0, maybe: 0, waitlist: 0 };
    rsvps.forEach((r: any) => {
      if (r.status in summary) summary[r.status]++;
    });

    return NextResponse.json({
      attendees: rsvps.map((r: any) => ({
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        status: r.status,
        registeredAt: r.registered_at,
      })),
      summary,
      total: rsvps.length,
    });
  } catch (error) {
    console.error("Error fetching attendees:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendees" },
      { status: 500 }
    );
  }
}

// PATCH - Update RSVP status for another user (organizer action)
// Retargeted to thread_rsvps status vocabulary (yes/no/maybe/waitlist).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Must be logged in" }, { status: 401 });
    }

    const body = await request.json();
    const { userId, status } = body;

    if (!userId || !status) {
      return NextResponse.json(
        { error: "userId and status are required" },
        { status: 400 }
      );
    }

    if (!["yes", "no", "maybe", "waitlist"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // TODO: verify current user is the thread's author (organizer).

    await db`
      INSERT INTO thread_rsvps (thread_id, user_id, status)
      VALUES (${threadId}, ${userId}, ${status})
      ON CONFLICT (thread_id, user_id)
      DO UPDATE SET status = ${status}, updated_at = NOW()
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating attendance:", error);
    return NextResponse.json(
      { error: "Failed to update attendance" },
      { status: 500 }
    );
  }
}
