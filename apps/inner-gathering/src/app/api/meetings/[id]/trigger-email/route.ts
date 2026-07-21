import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";

// ============================================================================
// Guide-triggered email blast to everyone RSVP'd 'yes' on a thread — either a
// "starting in X" reminder (with a one-click "still coming?" reconfirm link
// that emails the guide back, see rsvp/reconfirm/route.ts) or a cancellation
// notice. Manual/on-demand — distinct from the automatic minutes-before
// reminder tick in lib/reminders.ts.
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Must be logged in" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const type = body.type === "cancellation" ? "cancellation" : "reminder";

    const [thread] = await db`
      SELECT t.id, t.title, t.org_id, t.kind, t.is_rsvp_enabled, t.scheduled_at,
             t.location, t.meeting_url, t.video_link, t.nextcloud_talk_token,
             t.author_id, t.metadata,
             (SELECT COALESCE(display_name, email) FROM users WHERE id = ${session.user.id}) AS sender_name
      FROM threads t
      WHERE t.id = ${threadId} AND t.kind IN ('meeting', 'event', 'workshop')
    `;

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }
    if (!thread.is_rsvp_enabled) {
      return NextResponse.json({ error: "RSVP is not enabled for this thread" }, { status: 400 });
    }

    const userIsAdmin = await isAdmin(session.user.id);
    const coGuideIds: string[] = Array.isArray(thread.metadata?.coGuideIds) ? thread.metadata.coGuideIds : [];
    const isGuide = thread.author_id === session.user.id || coGuideIds.includes(session.user.id);
    if (!userIsAdmin && !isGuide) {
      return NextResponse.json({ error: "Only the guide or an admin can trigger this" }, { status: 403 });
    }

    const attendees = await db`
      SELECT u.email, COALESCE(u.display_name, u.email) AS name
      FROM thread_rsvps r
      JOIN users u ON u.id = r.user_id
      WHERE r.thread_id = ${threadId} AND r.status = 'yes' AND u.email IS NOT NULL
    `;

    if (attendees.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const talkRoomUrl = thread.nextcloud_talk_token
      ? new URL(`/api/talk/join?token=${thread.nextcloud_talk_token}`, request.nextUrl.origin).toString()
      : undefined;
    const materialsUrl = thread.kind === "workshop"
      ? new URL(`/workshops/${threadId}`, request.nextUrl.origin).toString()
      : undefined;
    const confirmUrl = new URL(`/api/meetings/${threadId}/rsvp/reconfirm`, request.nextUrl.origin).toString();

    const { sendMeetingTriggerEmail } = await import("@elkdonis/email");

    let sent = 0;
    for (const attendee of attendees) {
      try {
        await sendMeetingTriggerEmail(attendee.email as string, {
          type,
          guestName: attendee.name as string,
          meetingTitle: thread.title as string,
          scheduledAt: thread.scheduled_at ? String(thread.scheduled_at) : undefined,
          location: thread.location ? String(thread.location) : undefined,
          meetingUrl: (thread.video_link ?? thread.meeting_url) ? String(thread.video_link ?? thread.meeting_url) : undefined,
          talkRoomUrl,
          materialsUrl,
          senderName: (thread.sender_name as string) ?? "Your guide",
          confirmUrl: type === "reminder" ? confirmUrl : undefined,
        });
        sent++;
      } catch (sendErr) {
        console.error(`[trigger-email] send to ${attendee.email} failed:`, sendErr);
      }
    }

    return NextResponse.json({ success: true, sent, total: attendees.length });
  } catch (error) {
    console.error("Error triggering meeting email:", error);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
