import { db } from "@elkdonis/db";
import { getGathering, getOrgFeed, hasOrgRole } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { termHref, threadHref } from "@/lib/gather";

/**
 * One thread, in the shape the shared surface renders.
 *
 * This is the read half of every popup on the site, and IFAC had no
 * equivalent of any kind — which is why its hub could only ever navigate to
 * /hub/meetings/[slug]. A calendar day with one thing on it opens that thing,
 * so this route is what makes the shared faces work here at all.
 *
 * Access follows the THREAD, not the route — a published PUBLIC thread reads
 * for anyone (it is on a public page already), ORGANIZATION visibility needs
 * a role in this org, and anything unpublished needs an editor. That is what
 * lets a card on a public page open the same surface a hub tile does.
 *
 * 404 rather than 403 throughout: an unpublished item must not confirm that
 * it exists. The shared `loadThread` treats both the same way.
 */
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  slug: string;
  kind: string;
  status: string;
  visibility: string;
  section: string | null;
  excerpt: string | null;
  body: string | null;
  body_format: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  location: string | null;
  format: string | null;
  meeting_url: string | null;
  talk_token: string | null;
  recurrence_pattern: string | null;
  recurrence_until: string | null;
  is_rsvp_enabled: boolean;
  attendee_limit: number | null;
  rsvp_deadline: string | null;
  rsvp_count: number;
  author_name: string | null;
  author_photo: string | null;
  viewer_attending: boolean | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const viewer = await getViewer().catch(() => null);

  const [row] = await db<Row[]>`
    SELECT
      t.id, t.title, t.slug, t.kind, t.status, t.visibility, t.section,
      t.excerpt, t.body, t.body_format,
      t.metadata->>'coverImageUrl'        AS cover_image_url,
      t.published_at, t.scheduled_at, t.duration_minutes,
      t.location, t.format, t.meeting_url,
      t.nextcloud_talk_token              AS talk_token,
      t.recurrence_pattern, t.recurrence_until,
      t.is_rsvp_enabled, t.attendee_limit, t.rsvp_deadline,
      (SELECT COUNT(*)::int FROM thread_rsvps r
        WHERE r.thread_id = t.id AND r.status = 'yes') AS rsvp_count,
      u.display_name                      AS author_name,
      u.avatar_url                        AS author_photo,
      ${
        viewer
          ? db`(SELECT r.status = 'yes' FROM thread_rsvps r
                 WHERE r.thread_id = t.id AND r.user_id = ${viewer.userId})`
          : db`NULL::boolean`
      }                                   AS viewer_attending
    FROM threads t
    LEFT JOIN users u ON u.id = t.author_id
    WHERE t.id = ${id} AND t.org_id = ${siteConfig.orgId}
  `;

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const published = row.status === "published";
  const allowed =
    (published && row.visibility === "PUBLIC") ||
    (published && row.visibility === "ORGANIZATION" && Boolean(viewer?.role)) ||
    Boolean(viewer?.canEdit);
  if (!allowed) return Response.json({ error: "Not found" }, { status: 404 });

  const feed = row.section ? await getOrgFeed(siteConfig.orgId, row.section).catch(() => null) : null;

  // ── what this thread holds ───────────────────────────────────────────────
  // This route serves PUBLIC pages as well as the hub, so membership is
  // established here rather than inferred from the thread's visibility. It is
  // the only thing standing between a public meeting page and a living
  // document's share link, which grants edit and delete to anyone holding it.
  const isMember = viewer
    ? await hasOrgRole(viewer.userId, siteConfig.orgId, ["owner", "guide", "member"])
    : false;

  const gathering = await getGathering(row.id, {
    viewerUserId: viewer?.userId ?? null,
    isMember,
    orgId: siteConfig.orgId,
    hrefFor: threadHref,
    termHref,
    // Files dropped into the thread's folder list beside the edges.
    withFolder: true,
  });

  return Response.json({
    id: row.id,
    title: row.title,
    slug: row.slug,
    kind: row.kind,
    status: row.status,
    visibility: row.visibility,
    feed: feed ? { slug: feed.slug, name: feed.name } : null,
    excerpt: row.excerpt,
    // The column is `body` with a `body_format` companion — there is no
    // body_html column, though every row in the database today is 'html'.
    // Guarded rather than assumed: the surface renders this as markup, so a
    // markdown row arriving later must not be handed over as HTML.
    bodyHtml: row.body_format === "html" ? row.body : null,
    coverImageUrl: row.cover_image_url,
    author: row.author_name ? { name: row.author_name, photo: row.author_photo } : null,
    publishedAt: row.published_at,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    location: row.location,
    format: row.format,
    meetingUrl: row.meeting_url,
    talkToken: row.talk_token,
    recurrencePattern: row.recurrence_pattern,
    recurrenceUntil: row.recurrence_until,
    isRsvpEnabled: Boolean(row.is_rsvp_enabled),
    attendeeLimit: row.attendee_limit,
    rsvpDeadline: row.rsvp_deadline,
    rsvpCount: row.rsvp_count,
    viewerAttending: row.viewer_attending,
    ...gathering,
  });
}
