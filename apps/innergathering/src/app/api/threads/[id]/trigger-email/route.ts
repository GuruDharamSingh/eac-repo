import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { sendMeetingTriggerEmail } from "@elkdonis/email";
import { lastOccurrenceEnd } from "@elkdonis/utils";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Manual blast to everyone who said they're coming — a reminder the night
 * before, or word that this cycle is cancelled.
 *
 * Reaches both audiences: members from `thread_rsvps` and guests from
 * `guest_submissions`, deduplicated by email. A guest who RSVP'd without an
 * account still gets told the 4am gathering is off.
 *
 * Note: inner-gathering's version of this route links a `confirmUrl` at
 * /api/meetings/[id]/rsvp/reconfirm, which does not exist in either app — the
 * link 404s. Omitted here; the thread URL is in the email and RSVPs can be
 * changed from the page itself.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const type = body.type === "cancellation" ? "cancellation" : "reminder";

  const [thread] = await db<
    {
      id: string;
      title: string;
      slug: string;
      section: string | null;
      scheduled_at: Date | null;
      duration_minutes: number | null;
      recurrence_pattern: string | null;
      location: string | null;
      meeting_url: string | null;
    }[]
  >`
    SELECT id, title, slug, section, scheduled_at, duration_minutes,
           recurrence_pattern, location, meeting_url
    FROM threads
    WHERE id = ${id} AND org_id = ${siteConfig.orgId}
    LIMIT 1
  `;
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only this cycle's respondents — a monthly gathering shouldn't email
  // everyone who ever attended it.
  const cutoff = thread.scheduled_at
    ? lastOccurrenceEnd(thread.scheduled_at, thread.recurrence_pattern, thread.duration_minutes)
    : null;

  const recipients = await db<{ email: string; name: string | null }[]>`
    SELECT u.email, u.display_name AS name
    FROM thread_rsvps r
    JOIN users u ON u.id = r.user_id
    WHERE r.thread_id = ${id}
      AND r.status = 'yes'
      AND u.email IS NOT NULL
      ${cutoff ? db`AND r.updated_at > ${cutoff}` : db``}

    UNION

    SELECT g.email, g.name
    FROM guest_submissions g
    WHERE g.thread_id = ${id}
      AND g.kind = 'rsvp'
      AND g.email IS NOT NULL
      ${cutoff ? db`AND g.created_at > ${cutoff}` : db``}
  `;

  if (recipients.length === 0) {
    return NextResponse.json({ sent: 0, message: "Nobody has RSVP'd for this cycle yet." });
  }

  const threadUrl = thread.section
    ? `${request.nextUrl.origin}/${thread.section}/${thread.slug}`
    : request.nextUrl.origin;

  const results = await Promise.allSettled(
    recipients.map((r) =>
      sendMeetingTriggerEmail(r.email, {
        type,
        guestName: r.name ?? "friend",
        meetingTitle: thread.title,
        scheduledAt: thread.scheduled_at?.toISOString(),
        location: thread.location ?? undefined,
        meetingUrl: thread.meeting_url ?? threadUrl,
        senderName: editor.email,
        orgId: siteConfig.orgId,
        orgName: siteConfig.orgName,
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;
  if (failed > 0) {
    console.error(`[innergathering] trigger-email: ${failed}/${results.length} sends failed`);
  }

  return NextResponse.json({ sent, failed, type });
}
