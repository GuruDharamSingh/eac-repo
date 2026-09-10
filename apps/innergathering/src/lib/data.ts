import { db } from "@elkdonis/db";
import { lastOccurrenceEnd, nextOccurrence } from "@elkdonis/utils";
import { getOrgProfileBySlug, listOrgProfiles, type OrgProfile } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import type {
  Attendee,
  Guide,
  Material,
  SiteSections,
  Thread,
  ThreadCycleStatus,
} from "@/lib/types";

/**
 * Read layer for the public site.
 *
 * Convention carried over from the rest of the monorepo: every query is
 * fail-soft — it logs and returns an empty result rather than throwing, so a
 * schema drift or a dead connection degrades one section of a page instead of
 * 500-ing the whole site.
 *
 * Threads belong to a feed via `threads.section` = `org_feeds.slug`.
 */

const ORG = siteConfig.orgId;

// Shared column list. `body AS description` keeps the DB's naming from
// leaking into components; cycle counters are derived in-query so a feed page
// is one round trip regardless of how many meetings it lists.
// `threads` has no cover_image_url column (that lives on workshop_pages, which
// this site doesn't use), so the hero image rides in metadata rather than
// costing a migration for one nullable text field.
const THREAD_COLUMNS = db`
  t.id, t.title, t.slug, t.kind, t.section, t.status, t.visibility,
  t.body AS description, t.excerpt,
  t.metadata->>'coverImageUrl' AS cover_image_url,
  t.metadata->>'timeZone' AS time_zone,
  t.location, t.is_online, t.meeting_url, t.video_link,
  t.document_url, t.nextcloud_talk_token,
  t.scheduled_at, t.duration_minutes,
  t.is_rsvp_enabled, t.rsvp_deadline, t.attendee_limit, t.min_attendees,
  t.notify_on_min_attendees,
  t.recurrence_pattern, t.recurrence_until,
  t.author_id, t.published_at, t.created_at,
  u.display_name AS author_name,
  u.slug         AS author_slug,
  COALESCE(op.photo_override, u.avatar_url) AS author_photo
`;

// Author's global slug/avatar (users) plus this org's optional photo
// override (org_profiles) — see packages/services/src/profiles.ts. A guide
// need not be published here (op row may be absent) for their name/photo to
// still show on a thread they authored.
const THREAD_JOINS = db`
  FROM threads t
  LEFT JOIN users u         ON u.id = t.author_id
  LEFT JOIN org_profiles op ON op.user_id = t.author_id AND op.org_id = t.org_id
`;

interface ThreadRow {
  id: string;
  title: string;
  slug: string | null;
  kind: string;
  section: string | null;
  status: string;
  visibility: string;
  description: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  time_zone: string | null;
  location: string | null;
  is_online: boolean | null;
  meeting_url: string | null;
  video_link: string | null;
  document_url: string | null;
  nextcloud_talk_token: string | null;
  scheduled_at: Date | null;
  duration_minutes: number | null;
  is_rsvp_enabled: boolean | null;
  rsvp_deadline: Date | null;
  attendee_limit: number | null;
  min_attendees: number | null;
  notify_on_min_attendees: boolean;
  recurrence_pattern: string | null;
  recurrence_until: Date | null;
  author_id: string | null;
  published_at: Date | null;
  created_at: Date;
  author_name: string | null;
  author_slug: string | null;
  author_photo: string | null;
}

function mapThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug ?? row.id,
    kind: row.kind,
    feedSlug: row.section,
    status: row.status,
    visibility: row.visibility,
    description: row.description,
    excerpt: row.excerpt,
    coverImageUrl: row.cover_image_url,
    timeZone: row.time_zone,
    location: row.location,
    isOnline: row.is_online ?? false,
    meetingUrl: row.meeting_url,
    videoLink: row.video_link,
    documentUrl: row.document_url,
    talkToken: row.nextcloud_talk_token,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    isRsvpEnabled: row.is_rsvp_enabled ?? false,
    rsvpDeadline: row.rsvp_deadline,
    attendeeLimit: row.attendee_limit,
    minAttendees: row.min_attendees,
    notifyOnMinAttendees: row.notify_on_min_attendees ?? false,
    recurrencePattern: row.recurrence_pattern,
    recurrenceUntil: row.recurrence_until,
    authorId: row.author_id,
    authorName: row.author_name,
    authorSlug: row.author_slug,
    authorPhoto: row.author_photo,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    // The occurrence a visitor is actually looking at. For a recurring
    // meeting this rolls forward each cycle; for a one-off it's scheduledAt.
    nextOccurrenceAt: row.scheduled_at
      ? nextOccurrence(row.scheduled_at, row.recurrence_pattern, row.duration_minutes)
      : null,
  };
}

/** Published, publicly visible threads only — the filter every public read shares. */
const PUBLIC_FILTER = db`
  t.org_id = ${ORG}
  AND t.status = 'published'
  AND t.visibility = 'PUBLIC'
`;

/** Upcoming or undated; a meeting stays listed until 6h past its start. */
const UPCOMING_FILTER = db`
  (t.scheduled_at IS NULL OR t.scheduled_at >= NOW() - INTERVAL '6 hours'
   OR t.recurrence_pattern IS NOT NULL AND t.recurrence_pattern <> 'NONE')
`;

export async function getThreadsForFeed(feedSlug: string, limit = 30): Promise<Thread[]> {
  try {
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE ${PUBLIC_FILTER} AND t.section = ${feedSlug}
      ORDER BY
        t.scheduled_at ASC NULLS LAST,
        COALESCE(t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map(mapThread);
  } catch (err) {
    console.error(`[innergathering] getThreadsForFeed(${feedSlug}):`, err);
    return [];
  }
}

/** The next dated item in a feed — what the home page portal previews. */
export async function getNextInFeed(feedSlug: string): Promise<Thread | null> {
  try {
    const [row] = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE ${PUBLIC_FILTER}
        AND t.section = ${feedSlug}
        AND t.scheduled_at IS NOT NULL
        AND ${UPCOMING_FILTER}
      ORDER BY t.scheduled_at ASC
      LIMIT 1
    `;
    return row ? mapThread(row) : null;
  } catch (err) {
    console.error(`[innergathering] getNextInFeed(${feedSlug}):`, err);
    return null;
  }
}

export async function getThreadBySlug(feedSlug: string, slug: string): Promise<Thread | null> {
  try {
    const [row] = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE t.org_id = ${ORG}
        AND t.section = ${feedSlug}
        AND (t.slug = ${slug} OR t.id = ${slug})
        AND t.status = 'published'
      LIMIT 1
    `;
    return row ? mapThread(row) : null;
  } catch (err) {
    console.error(`[innergathering] getThreadBySlug(${feedSlug}/${slug}):`, err);
    return null;
  }
}

/** Any thread in this org by id, regardless of status — for editors. */
export async function getThreadById(id: string): Promise<Thread | null> {
  try {
    const [row] = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE t.org_id = ${ORG} AND t.id = ${id}
      LIMIT 1
    `;
    return row ? mapThread(row) : null;
  } catch (err) {
    console.error(`[innergathering] getThreadById(${id}):`, err);
    return null;
  }
}

/** Everything in the org, published or not — the /manage dashboard list. */
export async function getAllThreadsForOrg(limit = 100): Promise<Thread[]> {
  try {
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE t.org_id = ${ORG}
      ORDER BY COALESCE(t.scheduled_at, t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map(mapThread);
  } catch (err) {
    console.error("[innergathering] getAllThreadsForOrg:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// RSVP counts and cycle status
// ---------------------------------------------------------------------------

/**
 * Combined attendance intent for a thread.
 *
 * Two sources, deliberately: signed-in members land in `thread_rsvps`, guests
 * in `guest_submissions`. Most 4am sadhana attendees will never make an
 * account, so a members-only count would measure the wrong thing.
 *
 * For a recurring meeting, both sides are filtered to the current cycle so
 * counts reset each month rather than accumulating forever. The cutoff is
 * computed here in JS via lastOccurrenceEnd(); the SQL twin of this math
 * lives in inner-gathering's data.ts — see packages/utils/src/recurrence.ts.
 */
export async function getAttendanceCount(thread: Thread): Promise<number> {
  const cutoff = thread.scheduledAt
    ? lastOccurrenceEnd(thread.scheduledAt, thread.recurrencePattern, thread.durationMinutes)
    : null;

  try {
    const [row] = await db<{ count: string }[]>`
      SELECT (
        (SELECT COUNT(*) FROM thread_rsvps r
          WHERE r.thread_id = ${thread.id}
            AND r.status = 'yes'
            ${cutoff ? db`AND r.updated_at > ${cutoff}` : db``})
        +
        (SELECT COUNT(*) FROM guest_submissions g
          WHERE g.thread_id = ${thread.id}
            AND g.kind = 'rsvp'
            ${cutoff ? db`AND g.created_at > ${cutoff}` : db``})
      ) AS count
    `;
    return Number(row?.count ?? 0);
  } catch (err) {
    console.error(`[innergathering] getAttendanceCount(${thread.id}):`, err);
    return 0;
  }
}

/**
 * Whether a guide has confirmed or cancelled the current occurrence.
 *
 * This is the single most important fact on the Amrit Vela page: someone
 * deciding whether to set a 3:30am alarm needs it answered before anything
 * else. `pending` means nobody has said either way yet.
 */
export async function getCycleStatus(thread: Thread): Promise<ThreadCycleStatus> {
  if (!thread.scheduledAt) return "pending";

  const cutoff = lastOccurrenceEnd(
    thread.scheduledAt,
    thread.recurrencePattern,
    thread.durationMinutes
  );

  try {
    const [row] = await db<{ action: string }[]>`
      SELECT action
      FROM thread_cycle_events
      WHERE thread_id = ${thread.id}
        ${cutoff ? db`AND created_at > ${cutoff}` : db``}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (row?.action === "confirmed") return "confirmed";
    if (row?.action === "cancelled") return "cancelled";
    return "pending";
  } catch (err) {
    console.error(`[innergathering] getCycleStatus(${thread.id}):`, err);
    return "pending";
  }
}

/**
 * Whether this user's RSVP still counts. For a recurring meeting an RSVP
 * expires with its cycle, so someone who came last month is asked again
 * rather than being silently counted as attending.
 */
export async function getThreadRsvpForUser(thread: Thread, userId: string): Promise<boolean> {
  const cutoff = thread.scheduledAt
    ? lastOccurrenceEnd(thread.scheduledAt, thread.recurrencePattern, thread.durationMinutes)
    : null;

  try {
    const [row] = await db<{ status: string }[]>`
      SELECT status FROM thread_rsvps
      WHERE thread_id = ${thread.id}
        AND user_id = ${userId}
        ${cutoff ? db`AND updated_at > ${cutoff}` : db``}
      LIMIT 1
    `;
    return row?.status === "yes";
  } catch (err) {
    console.error(`[innergathering] getThreadRsvpForUser(${thread.id}):`, err);
    return false;
  }
}

/**
 * Who intends to come, members and guests together, for the current cycle.
 *
 * Guests are shown by first name only — they gave an email to RSVP, not to be
 * listed publicly by full name. Callers must gate this on membership.
 */
export async function listAttendees(thread: Thread, limit = 60): Promise<Attendee[]> {
  const cutoff = thread.scheduledAt
    ? lastOccurrenceEnd(thread.scheduledAt, thread.recurrencePattern, thread.durationMinutes)
    : null;

  try {
    const rows = await db<
      {
        name: string | null;
        is_member: boolean;
        photo_url: string | null;
        guide_slug: string | null;
        responded_at: Date;
      }[]
    >`
      SELECT
        u.display_name AS name,
        TRUE           AS is_member,
        u.avatar_url   AS photo_url,
        -- A link only where there is a page to land on: a public profile in
        -- THIS org. (This read artist_profiles; that table is being retired.)
        CASE WHEN op.user_id IS NOT NULL THEN u.slug END AS guide_slug,
        r.updated_at   AS responded_at
      FROM thread_rsvps r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN org_profiles op ON op.user_id = r.user_id AND op.org_id = ${ORG} AND op.is_public
      WHERE r.thread_id = ${thread.id}
        AND r.status = 'yes'
        ${cutoff ? db`AND r.updated_at > ${cutoff}` : db``}

      UNION ALL

      SELECT
        SPLIT_PART(COALESCE(NULLIF(g.name, ''), 'Guest'), ' ', 1) AS name,
        FALSE AS is_member,
        NULL  AS photo_url,
        NULL  AS guide_slug,
        g.created_at AS responded_at
      FROM guest_submissions g
      WHERE g.thread_id = ${thread.id}
        AND g.kind = 'rsvp'
        ${cutoff ? db`AND g.created_at > ${cutoff}` : db``}

      ORDER BY responded_at ASC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      name: r.name ?? "Guest",
      isMember: r.is_member,
      photoUrl: r.photo_url,
      guideSlug: r.guide_slug,
      respondedAt: r.responded_at,
    }));
  } catch (err) {
    console.error(`[innergathering] listAttendees(${thread.id}):`, err);
    return [];
  }
}

/** Files attached to a thread — shown as downloads on its page. */
export async function getThreadMaterials(threadId: string): Promise<Material[]> {
  try {
    const rows = await db<
      { id: string; url: string; filename: string | null; mime_type: string | null; size_bytes: number | null }[]
    >`
      SELECT id, url, filename, mime_type, size_bytes
      FROM media
      WHERE org_id = ${ORG}
        AND attached_to_type = 'thread'
        AND attached_to_id = ${threadId}
      ORDER BY created_at ASC
    `;
    return rows.map((r) => ({
      id: r.id,
      url: r.url,
      filename: r.filename ?? "Download",
      mimeType: r.mime_type,
      size: r.size_bytes,
    }));
  } catch (err) {
    console.error(`[innergathering] getThreadMaterials(${threadId}):`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Guides / teachers
//
// Backed by @elkdonis/services' profiles module (migration 084: users +
// org_profiles) rather than the old artist_profiles table — see that
// module's header for the identity/publish split. Mapped into this app's
// own Guide type so about/page.tsx and about/[slug]/page.tsx need no
// changes.
// ---------------------------------------------------------------------------

function mapGuide(op: OrgProfile): Guide {
  return {
    userId: op.userId,
    slug: op.slug ?? op.userId,
    displayName: op.displayName,
    roleTitle: op.roleTitle,
    bio: op.bio,
    photoUrl: op.avatarUrl,
    city: op.city,
    socialLinks: op.socialLinks as Guide["socialLinks"],
    sortOrder: op.sortOrder,
  };
}

/**
 * The public roster. `is_public` is opt-in (migration 073, carried into
 * org_profiles by 084) because member signup drafts a profile for every org
 * they join — without the flag, an about page would fill with empty stubs.
 */
export async function getGuides(): Promise<Guide[]> {
  const rows = await listOrgProfiles(ORG, { onlyPublic: true });
  return rows.map(mapGuide);
}

export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  const row = await getOrgProfileBySlug(ORG, slug);
  return row ? mapGuide(row) : null;
}

/** What a guide has published here — the body of their profile page. */
export async function getThreadsByAuthor(userId: string, limit = 20): Promise<Thread[]> {
  try {
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE ${PUBLIC_FILTER} AND t.author_id = ${userId}
      ORDER BY COALESCE(t.scheduled_at, t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map(mapThread);
  } catch (err) {
    console.error(`[innergathering] getThreadsByAuthor(${userId}):`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Editable page copy
// ---------------------------------------------------------------------------

/**
 * Site copy from org_site_sections, following the IFAC precedent
 * (migration 041). Returns a plain map so a caller can read
 * `sections.hero?.title` without a null dance per field.
 */
export async function getSiteSections(): Promise<SiteSections> {
  try {
    const rows = await db<{ section_key: string; content: unknown }[]>`
      SELECT section_key, content FROM org_site_sections WHERE org_id = ${ORG}
    `;
    const out: SiteSections = {};
    for (const row of rows) {
      if (row.content && typeof row.content === "object") {
        out[row.section_key] = row.content as Record<string, string>;
      }
    }
    return out;
  } catch (err) {
    console.error("[innergathering] getSiteSections:", err);
    return {};
  }
}
