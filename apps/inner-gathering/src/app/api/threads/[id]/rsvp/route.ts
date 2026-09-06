import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";
import { checkRsvpEligibility, setRsvpStatus, deleteRsvp } from "@elkdonis/services";
import { isWithinCurrentCycle } from "@/lib/recurrence";
import {
  EMAIL_TEMPLATE_ORG_ID,
  RSVP_GUEST_TEMPLATE_KEY,
  RSVP_OWNER_TEMPLATE_KEY,
  getEmailTemplateSettingsForThread,
} from "@/lib/email-template-settings";

// ============================================================================
// Thread-agnostic RSVP endpoint — works for any thread kind (meeting, event,
// workshop, and future kinds) since thread_rsvps has no kind column and
// eligibility/state live on the generic threads row. The core state and
// eligibility check come from @elkdonis/services (packages/services/src/
// thread-rsvp.ts) so any app in the monorepo can reuse the same primitives;
// what's kept here is app-specific orchestration: notifications, email
// templates, and the workshop materials-folder grant/revoke side effect.
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
      SELECT r.status, r.created_at, r.updated_at,
             t.scheduled_at, t.recurrence_pattern, t.duration_minutes
      FROM thread_rsvps r
      JOIN threads t ON t.id = r.thread_id
      WHERE r.thread_id = ${threadId} AND r.user_id = ${session.user.id}
    `;

    if (result.length === 0) {
      return NextResponse.json({ attending: false, status: null });
    }

    // For recurring meetings the RSVP expires once the occurrence it was made
    // for has passed — the member re-confirms each cycle.
    const row = result[0];
    const currentCycle = !row.scheduled_at || isWithinCurrentCycle(
      new Date(row.updated_at),
      new Date(row.scheduled_at),
      row.recurrence_pattern,
      row.duration_minutes
    );

    return NextResponse.json({
      attending: row.status === 'yes' && currentCycle,
      status: currentCycle ? row.status : null,
      registeredAt: row.created_at,
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const session = await getServerSession();
    const body = await request.json().catch(() => ({}));
    const receiveEmailNotice = body.receiveEmailNotice !== false;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Must be logged in to RSVP" },
        { status: 401 }
      );
    }

    const meeting = await db`
      SELECT
        t.id, t.title, t.org_id, t.kind, t.scheduled_at,
        t.location, t.meeting_url, t.nextcloud_talk_token,
        t.min_attendees, t.notify_on_min_attendees,
        t.min_attendees_notified, t.author_id AS guide_id,
        u.email AS guide_email,
        COALESCE(u.display_name, u.email) AS guide_name
      FROM threads t
      LEFT JOIN users u ON u.id = t.author_id
      WHERE t.kind IN ('meeting', 'event', 'workshop') AND t.id = ${threadId}
    `;

    if (meeting.length === 0) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const eligibility = await checkRsvpEligibility(threadId);
    if (!eligibility.ok) {
      return NextResponse.json({ error: eligibility.error }, { status: 400 });
    }

    await setRsvpStatus(threadId, session.user.id, 'yes');

    // Workshop materials: grant the attendee a read-only share of the
    // materials folder (requires a synced Nextcloud account). Non-blocking.
    void (async () => {
      try {
        if (meeting[0].kind !== 'workshop') return;
        const [ncUser] = await db`
          SELECT nextcloud_user_id FROM users
          WHERE id = ${session.user.id} AND nextcloud_synced = true
        `;
        if (!ncUser?.nextcloud_user_id) return;
        const { getAdminClient, grantMaterialsAccess } = await import('@elkdonis/nextcloud');
        await grantMaterialsAccess(
          getAdminClient(),
          meeting[0].org_id as string,
          threadId,
          ncUser.nextcloud_user_id as string,
          'attendee'
        );
      } catch (materialsErr) {
        console.error('[inner-gathering] materials share on RSVP failed:', materialsErr);
      }
    })();

    const rsvpCreatedAt = new Date().toISOString();
    const detailPath = meeting[0].kind === 'workshop' ? 'workshops' : 'meetings';
    const threadUrl = new URL(`/${detailPath}/${threadId}`, request.nextUrl.origin).toString();

    // In-app heads-up to the guide that someone's interested (skip self-RSVP).
    if (meeting[0].guide_id && meeting[0].guide_id !== session.user.id) {
      await db`
        INSERT INTO notifications (id, user_id, kind, thread_id, actor_id, data)
        VALUES (
          ${`notif_${Date.now()}_${Math.random().toString(36).substring(7)}`},
          ${meeting[0].guide_id},
          'meeting_rsvp',
          ${threadId},
          ${session.user.id},
          ${JSON.stringify({ title: meeting[0].title })}::jsonb
        )
      `.catch((e: unknown) => console.error("[inner-gathering] rsvp notification failed:", e));
    }

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
        WHERE id = ${threadId} AND kind IN ('meeting', 'event', 'workshop')
      `;

      await db`
        INSERT INTO notifications (id, user_id, kind, thread_id, actor_id, data, created_at)
        VALUES (
          ${`notif_${Date.now()}_${Math.random().toString(36).substring(7)}`},
          ${meeting[0].guide_id},
          'meeting_min_attendees',
          ${threadId},
          ${session.user.id},
          ${JSON.stringify({ title: meeting[0].title, minAttendees: meeting[0].min_attendees, attendeeCount: currentCount })},
          NOW()
        )
      `;
    }

    // Get the RSVP'ing user's display info for email
    const [attendee] = await db`
      SELECT COALESCE(display_name, email) AS name, email
      FROM users WHERE id = ${session.user.id}
    `;

    // Template settings live under the thread's org (falls back to the
    // inner_group defaults for legacy content without org-level templates).
    const templateOrgId = (meeting[0].org_id as string) || EMAIL_TEMPLATE_ORG_ID;

    const ownerTemplateSettings = await getEmailTemplateSettingsForThread(
      templateOrgId,
      RSVP_OWNER_TEMPLATE_KEY,
      threadId
    ).catch((settingsError) => {
      console.error('[inner-gathering] failed to load rsvp owner email settings:', settingsError);
      return null;
    });

    // Per-publication guest confirmation copy (falls back to org default)
    const guestTemplateSettings = await getEmailTemplateSettingsForThread(
      templateOrgId,
      RSVP_GUEST_TEMPLATE_KEY,
      threadId
    ).catch((settingsError) => {
      console.error('[inner-gathering] failed to load rsvp guest email settings:', settingsError);
      return null;
    });

    // Fire emails non-blocking
    void (async () => {
      try {
        const { sendRsvpConfirmation, sendRsvpNotification } = await import('@elkdonis/email');
        const guideEmail = meeting[0].guide_email as string | null;

        const baseEmailData = {
          guestName: (attendee?.name as string) ?? 'A member',
          guestEmail: (attendee?.email as string) ?? undefined,
          meetingTitle: meeting[0].title as string,
          scheduledAt: meeting[0].scheduled_at ? String(meeting[0].scheduled_at) : undefined,
          location: meeting[0].location ? String(meeting[0].location) : undefined,
          meetingUrl: meeting[0].meeting_url ? String(meeting[0].meeting_url) : undefined,
          talkRoomUrl: meeting[0].nextcloud_talk_token
            ? new URL(`/api/talk/join?token=${meeting[0].nextcloud_talk_token}`, request.nextUrl.origin).toString()
            : undefined,
          materialsUrl: meeting[0].kind === 'workshop' ? threadUrl : undefined,
          orgName: 'Inner Gathering',
          primaryColor: '#022278',
          rsvpCount: currentCount,
        };

        // Guest and owner copy are configured independently — don't let the
        // per-publication guest bodyText bleed into the owner notification.
        const guestEmailData = {
          ...baseEmailData,
          ...(guestTemplateSettings?.config ?? {}),
        };

        const ownerEmailData = {
          ...baseEmailData,
          rsvpCreatedAt,
          threadUrl,
          ...(ownerTemplateSettings?.config ?? {}),
        };

        const sends: Promise<void>[] = [];

        if (guideEmail) {
          sends.push(sendRsvpNotification(guideEmail, ownerEmailData));
        }

        if (receiveEmailNotice && attendee?.email) {
          sends.push(sendRsvpConfirmation(attendee.email as string, guestEmailData));
        }

        if (guideEmail && minAttendeesReached) {
          // Second email — explicitly flag the milestone
          sends.push(
            sendRsvpNotification(guideEmail, {
              ...ownerEmailData,
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
      authorNotificationQueued: Boolean(meeting[0].guide_email),
      confirmationEmailRequested: receiveEmailNotice,
      confirmationEmailQueued: receiveEmailNotice && Boolean(attendee?.email),
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

    await deleteRsvp(threadId, session.user.id);

    // Revoke the materials share if this was a workshop. Non-blocking.
    void (async () => {
      try {
        const [thread] = await db`
          SELECT kind, org_id FROM threads WHERE id = ${threadId}
        `;
        if (thread?.kind !== 'workshop') return;
        const [ncUser] = await db`
          SELECT nextcloud_user_id FROM users
          WHERE id = ${session.user.id} AND nextcloud_synced = true
        `;
        if (!ncUser?.nextcloud_user_id) return;
        const { getAdminClient, revokeMaterialsAccess } = await import('@elkdonis/nextcloud');
        await revokeMaterialsAccess(
          getAdminClient(),
          thread.org_id as string,
          threadId,
          ncUser.nextcloud_user_id as string
        );
      } catch (revokeErr) {
        console.error('[inner-gathering] materials share revoke failed:', revokeErr);
      }
    })();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error canceling RSVP:", error);
    return NextResponse.json(
      { error: "Failed to cancel attendance" },
      { status: 500 }
    );
  }
}
