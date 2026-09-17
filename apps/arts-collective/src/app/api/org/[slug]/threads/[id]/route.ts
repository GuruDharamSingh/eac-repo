import { db } from "@elkdonis/db";
import { getOrgRole } from "@elkdonis/services";
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
 * already established), and a draft needs an editor. Anything else answers
 * 404 rather than 403 — an unpublished item should not confirm it exists.
 */
export const dynamic = "force-dynamic";

const EDITOR_ROLES = new Set(["owner", "guide"]);

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
      status: string; visibility: string; excerpt: string | null;
      body: string | null; cover_image_url: string | null;
      author_name: string | null; author_photo: string | null;
      published_at: Date | null; scheduled_at: Date | null;
      duration_minutes: number | null; location: string | null;
      format: string | null; meeting_url: string | null;
      talk_token: string | null; recurrence_pattern: string | null;
      recurrence_until: Date | null; is_rsvp_enabled: boolean;
      attendee_limit: number | null; rsvp_deadline: Date | null;
      document_url: string | null; video_link: string | null;
      rsvp_count: number; viewer_attending: boolean;
    }>
  >`
    SELECT t.id, t.title, t.slug, t.kind, t.status, t.visibility, t.excerpt,
           t.body, t.metadata->>'coverImageUrl' AS cover_image_url,
           u.display_name AS author_name, u.avatar_url AS author_photo,
           t.published_at, t.scheduled_at, t.duration_minutes, t.location,
           t.format, t.meeting_url, t.nextcloud_talk_token AS talk_token,
           t.recurrence_pattern, t.recurrence_until, t.is_rsvp_enabled,
           t.attendee_limit, t.rsvp_deadline, t.document_url, t.video_link,
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
  if (row.status !== "published" && !EDITOR_ROLES.has(role)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

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
        meetingUrl: row.meeting_url,
        talkToken: row.talk_token,
        recurrencePattern: row.recurrence_pattern,
        recurrenceUntil: row.recurrence_until,
        isRsvpEnabled: row.is_rsvp_enabled,
        attendeeLimit: row.attendee_limit,
        rsvpDeadline: row.rsvp_deadline,
        documentUrl: row.document_url,
        videoLink: row.video_link,
      },
      { rsvpCount: row.rsvp_count, viewerAttending: row.viewer_attending }
    )
  );
}
