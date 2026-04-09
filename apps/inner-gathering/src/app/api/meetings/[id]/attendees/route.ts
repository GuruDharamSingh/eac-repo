import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";

// GET - Get all attendees for a meeting
export async function GET(
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

    const attendees = await db`
      SELECT
        ma.user_id,
        ma.attendance_status,
        ma.registered_at,
        u.display_name,
        u.avatar_url
      FROM meeting_attendees ma
      JOIN users u ON ma.user_id = u.id
      WHERE ma.meeting_id = ${meetingId}
      ORDER BY ma.registered_at ASC
    `;

    // Get counts by status
    const summary = {
      registered: 0,
      attended: 0,
      absent: 0,
    };

    attendees.forEach((a: any) => {
      if (a.attendance_status in summary) {
        summary[a.attendance_status as keyof typeof summary]++;
      }
    });

    return NextResponse.json({
      attendees: attendees.map((a: any) => ({
        userId: a.user_id,
        displayName: a.display_name,
        avatarUrl: a.avatar_url,
        status: a.attendance_status,
        registeredAt: a.registered_at,
      })),
      summary,
      total: attendees.length,
    });
  } catch (error) {
    console.error("Error fetching attendees:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendees" },
      { status: 500 }
    );
  }
}

// PATCH - Update attendance status (for marking attended/absent after meeting)
export async function PATCH(
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

    const body = await request.json();
    const { userId, status } = body;

    if (!userId || !status) {
      return NextResponse.json(
        { error: "userId and status are required" },
        { status: 400 }
      );
    }

    if (!["registered", "attended", "absent"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    // TODO: Check if current user is the guide/organizer of this meeting
    // For now, allow any logged-in user to update (should be restricted later)

    await db`
      UPDATE meeting_attendees
      SET attendance_status = ${status}
      WHERE meeting_id = ${meetingId} AND user_id = ${userId}
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
