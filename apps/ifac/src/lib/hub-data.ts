import { db } from "@elkdonis/db";
import { nextOccurrence } from "@elkdonis/utils";
import { getOrgFolderPath } from "@elkdonis/nextcloud";
import { siteConfig } from "@/config/site";

/**
 * Reads behind the hub tiles.
 *
 * The design constraint the hub is built around: every tile shows real
 * information on first paint, and the modal behind it is where the detail and
 * the write actions live. So each function here is deliberately narrow and
 * cheap — a card query returns the three or four fields a tile draws, never a
 * whole record set the modal might later want. The modal fetches its own data
 * on open, through the /api/hub/* routes.
 *
 * Every read is fail-soft (try/catch → empty), matching the rest of
 * apps/ifac/src/lib/data.ts. A hub tile that throws takes the whole page down;
 * one that renders empty is legible and recoverable.
 */

const ORG = siteConfig.orgId;

/** Thread kinds that represent something happening at a time. */
const SCHEDULED_KINDS = ["event", "meeting", "workshop"];

export type HubEvent = {
  id: string;
  title: string;
  slug: string;
  kind: string;
  scheduledAt: string | null;
  /** For a recurring thread, the occurrence a visitor is looking at now. */
  nextOccurrenceAt: string | null;
  durationMinutes: number | null;
  location: string | null;
  format: string | null;
  meetingUrl: string | null;
  talkToken: string | null;
  coverImageUrl: string | null;
  recurrencePattern: string | null;
  rsvpCount: number;
  attendeeLimit: number | null;
};

/**
 * `threads` has no cover_image_url column — that lives on workshop_pages,
 * which IFAC doesn't use. amrit-canada established the convention of carrying
 * the hero image in `metadata` rather than spending a migration on one
 * nullable text field, and this follows it.
 */
const EVENT_COLUMNS = db`
  t.id, t.title, t.slug, t.kind, t.scheduled_at, t.duration_minutes,
  t.location, t.format, t.meeting_url, t.nextcloud_talk_token,
  t.recurrence_pattern, t.attendee_limit,
  t.metadata->>'coverImageUrl' AS cover_image_url
`;

type EventRow = {
  id: string;
  title: string;
  slug: string;
  kind: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  location: string | null;
  format: string | null;
  meeting_url: string | null;
  nextcloud_talk_token: string | null;
  recurrence_pattern: string | null;
  attendee_limit: number | null;
  cover_image_url: string | null;
  rsvp_count?: number;
};

function mapEvent(row: EventRow): HubEvent {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    kind: row.kind,
    scheduledAt: row.scheduled_at,
    nextOccurrenceAt: row.scheduled_at
      ? nextOccurrence(
          new Date(row.scheduled_at),
          row.recurrence_pattern,
          row.duration_minutes
        ).toISOString()
      : null,
    durationMinutes: row.duration_minutes,
    location: row.location,
    format: row.format,
    meetingUrl: row.meeting_url,
    talkToken: row.nextcloud_talk_token,
    coverImageUrl: row.cover_image_url,
    recurrencePattern: row.recurrence_pattern,
    rsvpCount: row.rsvp_count ?? 0,
    attendeeLimit: row.attendee_limit,
  };
}

/**
 * The group's standing weekly meeting.
 *
 * "The weekly meeting" is not a concept the schema had, and four mechanisms
 * were candidates for expressing it. This uses two that already exist together:
 * `section = 'weekly-meeting'` (migration 073 made site sections data, and an
 * org_feeds row gives the card a name and a "see all" destination) plus
 * `recurrence_pattern = 'WEEKLY'` (which makes nextOccurrence() work). Neither
 * a new column nor a fifth metadata key was needed.
 *
 * Falls back to any weekly-recurring thread when the section hasn't been
 * seeded, so the card works before an admin has organised the feeds.
 */
export async function getWeeklyMeeting(): Promise<HubEvent | null> {
  try {
    const [row] = await db<EventRow[]>`
      SELECT ${EVENT_COLUMNS},
             (SELECT COUNT(*)::int FROM thread_rsvps r
               WHERE r.thread_id = t.id AND r.status = 'yes') AS rsvp_count
      FROM threads t
      WHERE t.org_id = ${ORG}
        AND t.status = 'published'
        AND t.kind = ANY(${SCHEDULED_KINDS})
        AND (t.section = 'weekly-meeting' OR t.recurrence_pattern = 'WEEKLY')
      ORDER BY (t.section = 'weekly-meeting') DESC,
               t.scheduled_at DESC NULLS LAST
      LIMIT 1
    `;
    return row ? mapEvent(row) : null;
  } catch (error) {
    console.error("[ifac] getWeeklyMeeting error:", error);
    return null;
  }
}

/**
 * Dated threads overlapping a window, for the calendar tile.
 *
 * Recurring threads are expanded client-side from `recurrencePattern` — one
 * row can be many cells — so this returns anything whose series could still be
 * running, not only rows whose single `scheduled_at` lands inside the window.
 */
export async function getEventsInRange(
  from: Date,
  to: Date
): Promise<HubEvent[]> {
  try {
    const rows = await db<EventRow[]>`
      SELECT ${EVENT_COLUMNS},
             (SELECT COUNT(*)::int FROM thread_rsvps r
               WHERE r.thread_id = t.id AND r.status = 'yes') AS rsvp_count
      FROM threads t
      WHERE t.org_id = ${ORG}
        AND t.status = 'published'
        AND t.kind = ANY(${SCHEDULED_KINDS})
        AND t.scheduled_at IS NOT NULL
        AND t.scheduled_at < ${to.toISOString()}
        AND (t.recurrence_pattern IS NOT NULL
             OR t.scheduled_at >= ${from.toISOString()})
      ORDER BY t.scheduled_at ASC
      LIMIT 200
    `;
    return rows.map(mapEvent);
  } catch (error) {
    console.error("[ifac] getEventsInRange error:", error);
    return [];
  }
}

export type HubIdea = {
  id: string;
  title: string;
  body: string | null;
  authorName: string | null;
  createdAt: string;
  status: string;
  replyCount: number;
};

/**
 * Member suggestions.
 *
 * Stored as threads with `kind = 'idea'`. `threads.kind` carries no CHECK
 * constraint any more, and going through threads means an idea gets
 * authorship, a status, replies and moderation for free — where
 * `guest_submissions` (the other candidate) is email-keyed and anonymous,
 * which is the opposite of what a members' suggestion queue wants.
 */
export async function listIdeas(limit = 20): Promise<HubIdea[]> {
  try {
    const rows = await db<
      Array<{
        id: string;
        title: string;
        body: string | null;
        author_name: string | null;
        created_at: string;
        status: string;
        reply_count: number;
      }>
    >`
      SELECT t.id, t.title, t.body, t.status, t.created_at,
             u.display_name AS author_name,
             (SELECT COUNT(*)::int FROM replies r
               WHERE r.thread_id = t.id) AS reply_count
      FROM threads t
      LEFT JOIN users u ON u.id = t.author_id
      WHERE t.org_id = ${ORG} AND t.kind = 'idea'
      ORDER BY t.created_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      authorName: r.author_name,
      createdAt: r.created_at,
      status: r.status,
      replyCount: r.reply_count,
    }));
  } catch (error) {
    console.error("[ifac] listIdeas error:", error);
    return [];
  }
}

export type LivingDocument = {
  id: string;
  title: string;
  url: string;
  editUrl: string;
  createdAt: string;
};

/**
 * The org's living documents.
 *
 * Nothing enumerated these before. The files themselves are named
 * `<timestamp>-<id>.md` in Nextcloud, so a title is NOT recoverable from the
 * path — it has to be recorded at creation time. `site_config` is the store
 * (the same place inner-gathering keeps its single about-document), keyed
 * `living_documents` and holding the whole list, so this costs no migration.
 */
export async function listLivingDocuments(): Promise<LivingDocument[]> {
  try {
    const [row] = await db<Array<{ value: unknown }>>`
      SELECT value FROM site_config
      WHERE org_id = ${ORG} AND key = 'living_documents'
    `;
    const value = row?.value;
    if (!Array.isArray(value)) return [];
    return (value as LivingDocument[])
      .filter((d) => d && typeof d.url === "string")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch (error) {
    console.error("[ifac] listLivingDocuments error:", error);
    return [];
  }
}

/**
 * The org's storage root.
 *
 * Derived, never read from `organizations.nextcloud_folder_path` — that column
 * is empty for ifac (the org was seeded by migrations 041/053, which predate
 * it, and only the admin app's setup-folders route ever backfills it) while
 * the folder itself demonstrably exists on Nextcloud. Deriving is correct for
 * every org; reading would make ifac a special case.
 */
export function orgStorageRoot(): string {
  return getOrgFolderPath(ORG);
}

export type ProfileSummary = {
  slug: string | null;
  displayName: string;
  avatarUrl: string | null;
  headline: string | null;
  roleTitle: string | null;
  bioLength: number;
  galleryCount: number;
  unreadMessages: number;
  upcomingCount: number;
};

/**
 * The signed-in member, as their own tile shows them.
 *
 * One round trip for the profile and one aggregate for the counts, because
 * this is above the fold on every hub load. The counts are the "quick look"
 * the tile promises; the modal fetches the actual messages and dates.
 */
export async function getProfileSummary(
  userId: string
): Promise<ProfileSummary | null> {
  try {
    const [row] = await db<
      Array<{
        slug: string | null;
        display_name: string | null;
        avatar_url: string | null;
        headline: string | null;
        bio: string | null;
        portfolio: unknown;
        role_title: string | null;
      }>
    >`
      SELECT u.slug, u.display_name, u.avatar_url, u.headline, u.bio,
             u.portfolio, op.role_title
      FROM users u
      LEFT JOIN org_profiles op
        ON op.user_id = u.id AND op.org_id = ${ORG}
      WHERE u.id = ${userId}
    `;
    if (!row) return null;

    const [counts] = await db<
      Array<{ unread: number; upcoming: number }>
    >`
      SELECT
        (SELECT COUNT(*)::int
           FROM message m
           JOIN conversation_participant cp
             ON cp.conversation_id = m.conversation_id
          WHERE cp.user_id = ${userId}
            AND m.sender_id <> ${userId}
            AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
        ) AS unread,
        (SELECT COUNT(*)::int
           FROM thread_rsvps r
           JOIN threads t ON t.id = r.thread_id
          WHERE r.user_id = ${userId}
            AND r.status = 'yes'
            AND t.org_id = ${ORG}
            AND t.scheduled_at >= NOW()
        ) AS upcoming
    `;

    const portfolio = Array.isArray(row.portfolio) ? row.portfolio : [];
    return {
      slug: row.slug,
      displayName: row.display_name || "Your profile",
      avatarUrl: row.avatar_url,
      headline: row.headline,
      roleTitle: row.role_title,
      bioLength: (row.bio ?? "").trim().length,
      galleryCount: portfolio.length,
      unreadMessages: counts?.unread ?? 0,
      upcomingCount: counts?.upcoming ?? 0,
    };
  } catch (error) {
    console.error("[ifac] getProfileSummary error:", error);
    return null;
  }
}
