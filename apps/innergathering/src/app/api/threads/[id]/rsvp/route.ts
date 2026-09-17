import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import {
  checkRsvpEligibility,
  deleteRsvp,
  getRsvpStatus,
  setRsvpStatus,
} from "@elkdonis/services";
import { sendRsvpConfirmation, sendRsvpNotification } from "@elkdonis/email";
import { isWithinCurrentCycle } from "@elkdonis/utils";
import { getViewer } from "@/lib/auth";
import { shareWorkshopMaterials } from "@/lib/workshop-share";
import { siteConfig } from "@/config/site";

/**
 * Member RSVP. Guests use /api/rsvp instead.
 *
 * Built on the kind-agnostic primitives in @elkdonis/services/thread-rsvp —
 * eligibility, capacity and the upsert live there and stay free of any
 * per-kind branching. Everything kind- or site-specific (emails, the
 * min-attendees nudge) is layered here.
 *
 * Every query is scoped by org_id. The route this replaces looked threads up
 * by id alone, which let a member of any org RSVP to any thread in the
 * database.
 */

interface ThreadRow {
  id: string;
  kind: string;
  title: string;
  slug: string;
  section: string | null;
  scheduled_at: Date | null;
  duration_minutes: number | null;
  recurrence_pattern: string | null;
  location: string | null;
  meeting_url: string | null;
  min_attendees: number | null;
  notify_on_min_attendees: boolean;
  min_attendees_notified: boolean;
  author_id: string;
  author_email: string | null;
}

async function loadThread(threadId: string): Promise<ThreadRow | null> {
  const [row] = await db<ThreadRow[]>`
    SELECT t.id, t.kind, t.title, t.slug, t.section, t.scheduled_at, t.duration_minutes,
           t.recurrence_pattern, t.location, t.meeting_url,
           t.min_attendees, t.notify_on_min_attendees, t.min_attendees_notified,
           t.author_id, u.email AS author_email
    FROM threads t
    LEFT JOIN users u ON u.id = t.author_id
    WHERE t.id = ${threadId}
      AND t.org_id = ${siteConfig.orgId}
      AND t.status = 'published'
    LIMIT 1
  `;
  return row ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ attending: false, status: null });

  const thread = await loadThread(id);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [row] = await db<{ status: string; updated_at: Date }[]>`
    SELECT status, updated_at FROM thread_rsvps
    WHERE thread_id = ${id} AND user_id = ${viewer.userId}
  `;

  if (!row) return NextResponse.json({ attending: false, status: null });

  // A recurring gathering's RSVP expires with its cycle: someone who came last
  // month is asked again rather than being counted as attending forever.
  const current =
    !thread.scheduled_at ||
    isWithinCurrentCycle(
      row.updated_at,
      thread.scheduled_at,
      thread.recurrence_pattern,
      thread.duration_minutes
    );

  return NextResponse.json({
    attending: current && row.status === "yes",
    status: current ? row.status : null,
    registeredAt: row.updated_at,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in to RSVP" }, { status: 401 });

  const thread = await loadThread(id);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const receiveEmailNotice = body.receiveEmailNotice !== false;

  const eligibility = await checkRsvpEligibility(id);
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 409 });
  }

  const previous = await getRsvpStatus(id, viewer.userId);
  await setRsvpStatus(id, viewer.userId, "yes");

  // Joining a workshop opens its materials. The page reads that from the
  // RSVP itself (media-authz); the Nextcloud share is the optional second
  // door and must never hold up the response.
  if (thread.kind === "workshop") void shareWorkshopMaterials(id, viewer.userId, "attendee");

  const [{ count }] = await db<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM thread_rsvps
    WHERE thread_id = ${id} AND status = 'yes'
  `;

  // One-shot: guarded by the min_attendees_notified column so a gathering that
  // hovers at the threshold doesn't email the guide on every RSVP.
  const minAttendeesReached =
    thread.notify_on_min_attendees &&
    !thread.min_attendees_notified &&
    thread.min_attendees !== null &&
    count >= thread.min_attendees;

  if (minAttendeesReached) {
    await db`UPDATE threads SET min_attendees_notified = TRUE WHERE id = ${id}`;
  }

  const threadUrl = thread.section
    ? `${request.nextUrl.origin}/${thread.section}/${thread.slug}`
    : request.nextUrl.origin;

  // Fire-and-forget. The email client no-ops with a warning when
  // SENDGRID_API_KEY is unset, so a dev environment never blocks on this and
  // a delivery failure never costs someone their RSVP.
  void (async () => {
    const scheduledAt = thread.scheduled_at?.toISOString();

    try {
      if (receiveEmailNotice && previous !== "yes") {
        await sendRsvpConfirmation(viewer.email, {
          guestName: viewer.email.split("@")[0],
          meetingTitle: thread.title,
          section: thread.section ?? undefined,
          scheduledAt,
          location: thread.location ?? undefined,
          meetingUrl: thread.meeting_url ?? undefined,
          orgId: siteConfig.orgId,
          orgName: siteConfig.orgName,
        });
      }
    } catch (err) {
      console.error("[innergathering] rsvp confirmation email:", err);
    }

    // Guest and owner emails are configured separately on purpose — the
    // author's own copy shouldn't leak into the notification they receive.
    const notifyTo = thread.author_email ?? siteConfig.fallbackNotifyEmail;
    try {
      if (notifyTo && previous !== "yes") {
        await sendRsvpNotification(notifyTo, {
          guestName: viewer.email,
          guestEmail: viewer.email,
          meetingTitle: thread.title,
          section: thread.section ?? undefined,
          scheduledAt,
          threadUrl,
          orgId: siteConfig.orgId,
          orgName: siteConfig.orgName,
          rsvpCount: count,
        });
      }

      if (minAttendeesReached && notifyTo) {
        await sendRsvpNotification(notifyTo, {
          guestName: viewer.email,
          meetingTitle: thread.title,
          section: thread.section ?? undefined,
          scheduledAt,
          threadUrl,
          orgId: siteConfig.orgId,
          orgName: siteConfig.orgName,
          rsvpCount: count,
          guestMessage: `Minimum attendees threshold of ${thread.min_attendees} has been reached.`,
        });
      }
    } catch (err) {
      console.error("[innergathering] rsvp owner notification:", err);
    }
  })();

  return NextResponse.json({ attending: true, count, minAttendeesReached });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const thread = await loadThread(id);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteRsvp(id, viewer.userId);
  if (thread.kind === "workshop") void shareWorkshopMaterials(id, viewer.userId, "none");
  return NextResponse.json({ attending: false });
}
