import { db } from "@elkdonis/db";
import { getIdentityIds, getOrgRole, mayReceiveJoinLink } from "@elkdonis/services";
import { canViewThread, type ThreadRole } from "@elkdonis/services/thread-audience";
import { isAdmin } from "@elkdonis/auth-server";
import { toSurfaceThread } from "@elkdonis/cms-ui/surface";
import { requireUser } from "@/lib/session";

/**
 * One thread, in the shape the shared surface renders.
 *
 * The read half of every popup the console opens: a face knows a title and a
 * date, the surface needs the rest.
 *
 * Access follows the THREAD, not the route. A published PUBLIC thread reads
 * for any member of the org, ORGANIZATION needs membership (which the gate
 * already established), INVITE_ONLY needs its min_role, and a draft needs an
 * editor (canViewThread). Anything else answers 404 rather than 403 — an
 * unpublished item should not confirm it exists.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const user = await requireUser();

  const orgs = await db<{ id: string }[]>`
    SELECT id FROM organizations WHERE slug = ${slug} LIMIT 1
  `;
  const orgId = orgs[0]?.id;
  if (!orgId) return Response.json({ error: "Not found" }, { status: 404 });

  const role = await getOrgRole(user.id, orgId);
  if (!role) return Response.json({ error: "Not found" }, { status: 404 });

  const [row] = await db<
    Array<{
      id: string; title: string; slug: string | null; kind: string;
      status: string; visibility: string; min_role: string | null;
      author_id: string | null; excerpt: string | null;
      body: string | null; cover_image_url: string | null;
      author_name: string | null; author_photo: string | null;
      published_at: Date | null; scheduled_at: Date | null;
      duration_minutes: number | null; location: string | null;
      format: string | null; meeting_url: string | null;
      talk_token: string | null; recurrence_pattern: string | null;
      recurrence_until: Date | null; is_rsvp_enabled: boolean;
      attendee_limit: number | null; rsvp_deadline: Date | null;
      document_url: string | null; video_link: string | null;
      rsvp_count: number; viewer_attending: boolean; pinned: boolean;
    }>
  >`
    SELECT t.id, t.title, t.slug, t.kind, t.status, t.visibility, t.min_role,
           t.author_id, t.excerpt,
           t.body, t.metadata->>'coverImageUrl' AS cover_image_url,
           u.display_name AS author_name, u.avatar_url AS author_photo,
           t.published_at, t.scheduled_at, t.duration_minutes, t.location,
           t.format, t.meeting_url, t.nextcloud_talk_token AS talk_token,
           t.recurrence_pattern, t.recurrence_until, t.is_rsvp_enabled,
           t.attendee_limit, t.rsvp_deadline, t.document_url, t.video_link,
           t.pinned,
           (SELECT COUNT(*)::int FROM thread_rsvps r
             WHERE r.thread_id = t.id AND r.status = 'yes') AS rsvp_count,
           EXISTS (SELECT 1 FROM thread_rsvps r
                    WHERE r.thread_id = t.id AND r.user_id = ${user.id}
                      AND r.status = 'yes') AS viewer_attending
    FROM threads t
    LEFT JOIN users u ON u.id = t.author_id
    WHERE t.id = ${id} AND t.org_id = ${orgId}
  `;

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  // Until 2026-11-04 this tested status only, so anyone with a role, a follower
  // included, read a members-only or only-me thread by id. A piece written under
  // a pen name is still its author's.
  const mine = await getIdentityIds(user.id);
  const readable = canViewThread(
    {
      visibility: row.visibility,
      minRole: row.min_role,
      authorId: row.author_id && mine.includes(row.author_id) ? user.id : row.author_id ?? "",
      status: row.status,
    },
    {
      userId: user.id,
      role: role as ThreadRole,
      isGlobalAdmin: await isAdmin(user.id).catch(() => false),
    }
  );
  if (!readable) return Response.json({ error: "Not found" }, { status: 404 });
  // The join link only for people who RSVP'd, hosts and editors (join-link.ts).
  const mayJoin =
    Boolean(row.meeting_url || row.talk_token) &&
    (await mayReceiveJoinLink(row.id, user.id, { canEdit: role === "owner" || role === "guide" }));

  return Response.json(
    toSurfaceThread(
      {
        id: row.id,
        title: row.title,
        slug: row.slug ?? "",
        kind: row.kind,
        status: row.status,
        visibility: row.visibility,
        excerpt: row.excerpt,
        bodyHtml: row.body,
        coverImageUrl: row.cover_image_url,
        authorName: row.author_name,
        authorPhoto: row.author_photo,
        publishedAt: row.published_at,
        scheduledAt: row.scheduled_at,
        durationMinutes: row.duration_minutes,
        location: row.location,
        format: row.format,
        meetingUrl: mayJoin ? row.meeting_url : null,
        talkToken: mayJoin ? row.talk_token : null,
        recurrencePattern: row.recurrence_pattern,
        recurrenceUntil: row.recurrence_until,
        isRsvpEnabled: row.is_rsvp_enabled,
        attendeeLimit: row.attendee_limit,
        rsvpDeadline: row.rsvp_deadline,
        // A public writable share: holding the link is the permission, so a
        // follower (viewer role) reads the thread without it.
        documentUrl: role === "viewer" ? null : row.document_url,
        videoLink: row.video_link,
      },
      // `pinned` rides in `extra` for the console's "Lead the site" action.
      { rsvpCount: row.rsvp_count, viewerAttending: row.viewer_attending, extra: { pinned: Boolean(row.pinned) } }
    )
  );
}
