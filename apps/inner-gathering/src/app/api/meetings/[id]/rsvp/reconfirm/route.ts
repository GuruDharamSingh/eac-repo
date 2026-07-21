import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";

// ============================================================================
// One-click "still coming?" link from a trigger-email reminder
// (see ../../trigger-email/route.ts). No per-recipient token — it just acts
// on the logged-in session's own 'yes' RSVP, touching updated_at (the same
// signal isWithinCurrentCycle()/ATTENDEE_COUNT_SQL already use to treat a
// recurring RSVP as reaffirmed for the current cycle) and emails the guide
// back with the confirmation.
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: threadId } = await params;
  const session = await getServerSession();

  if (!session?.user?.id) {
    const returnTo = new URL(`/api/meetings/${threadId}/rsvp/reconfirm`, request.nextUrl.origin).toString();
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(loginUrl);
  }

  const [existing] = await db`
    SELECT r.status, t.title, t.kind, t.author_id,
           COALESCE(guest.display_name, guest.email) AS guest_name,
           guide.email AS guide_email
    FROM thread_rsvps r
    JOIN threads t ON t.id = r.thread_id
    JOIN users guest ON guest.id = r.user_id
    LEFT JOIN users guide ON guide.id = t.author_id
    WHERE r.thread_id = ${threadId} AND r.user_id = ${session.user.id}
  `;

  const detailPath = existing?.kind === "workshop" ? `/workshops/${threadId}` : `/meetings/${threadId}`;
  const detailUrl = new URL(detailPath, request.nextUrl.origin);

  if (!existing || existing.status !== "yes") {
    return NextResponse.redirect(detailUrl);
  }

  await db`
    UPDATE thread_rsvps SET updated_at = NOW()
    WHERE thread_id = ${threadId} AND user_id = ${session.user.id}
  `;

  if (existing.guide_email && existing.author_id !== session.user.id) {
    try {
      const { sendRsvpNotification } = await import("@elkdonis/email");
      await sendRsvpNotification(existing.guide_email as string, {
        variant: "reconfirmed",
        guestName: existing.guest_name as string,
        meetingTitle: existing.title as string,
        rsvpCreatedAt: new Date().toISOString(),
        threadUrl: detailUrl.toString(),
      });
    } catch (emailErr) {
      console.error("[rsvp/reconfirm] guide notification failed:", emailErr);
    }
  }

  detailUrl.searchParams.set("confirmed", "1");
  return NextResponse.redirect(detailUrl);
}
