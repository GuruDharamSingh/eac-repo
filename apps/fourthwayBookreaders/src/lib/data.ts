import { db } from "@elkdonis/db";
import { nextOccurrence, sanitizeRichText } from "@elkdonis/utils";
import {
  countConfirmedRsvps,
  getRsvpStatus,
  listCenterQuotes,
  listOrgFiles,
  listOrgMediaLibrary,
  OFF_FEED_KINDS,
  type Quote,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";
// Media URLs are stored canonical (`/api/media/...`) and prefixed on the way
// OUT, never on the way in — so the rows stay portable if this app is later
// moved to a domain of its own.
import { withBase, withBaseMaybe } from "@/lib/base-path";
import { READING_GROUP_KIND } from "@/lib/types";
import type {
  BookPage,
  CurrentBook,
  MeetingRecording,
  MeetingStructure,
  SessionNote,
  ShelfItem,
  SiteSections,
  SuggestedBook,
  Thread,
} from "@/lib/types";

/**
 * Read layer for the public site.
 *
 * Convention carried from the rest of the monorepo: every query is fail-soft.
 * It logs and returns an empty result rather than throwing, so a schema drift
 * or a dead connection greys out one band of the home page instead of 500-ing
 * the whole site. The home page composes about a dozen of these, which is the
 * whole reason the rule exists.
 *
 * Threads belong to a feed via `threads.section` = `org_feeds.slug`.
 */

const ORG = siteConfig.orgId;

// `threads` has no cover_image_url column (that lives on workshop_pages), so
// the cover rides in metadata rather than costing a migration for one
// nullable text field. Same choice amrit-canada made.
const THREAD_COLUMNS = db`
  t.id, t.title, t.slug, t.kind, t.section, t.status, t.visibility,
  t.body AS description, t.excerpt,
  t.metadata->>'coverImageUrl' AS cover_image_url,
  t.location, t.is_online, t.meeting_url, t.video_link,
  t.document_url, t.nextcloud_talk_token,
  t.scheduled_at, t.duration_minutes,
  t.is_rsvp_enabled, t.rsvp_deadline, t.attendee_limit,
  t.recurrence_pattern, t.recurrence_until,
  t.metadata->'book'->>'title'  AS book_title,
  t.metadata->'book'->>'author' AS book_author,
  t.metadata->>'currentPage'    AS current_page,
  t.metadata->>'pagesFrom'      AS pages_from,
  t.metadata->>'pagesTo'        AS pages_to,
  t.metadata->>'recordingUrl'   AS recording_url,
  t.author_id, t.published_at, t.created_at,
  u.display_name AS author_name,
  COALESCE(op.photo_override, u.avatar_url) AS author_photo
`;

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
  recurrence_pattern: string | null;
  recurrence_until: Date | null;
  book_title: string | null;
  book_author: string | null;
  current_page: string | null;
  pages_from: string | null;
  pages_to: string | null;
  recording_url: string | null;
  author_id: string | null;
  published_at: Date | null;
  created_at: Date;
  author_name: string | null;
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
    // Sanitised HERE, on read. createThread in @elkdonis/services stores the
    // body as given (only the forum and writing paths sanitise on write), and
    // threads reach this table from every authoring surface on the network —
    // so the page that injects it as HTML cannot assume someone upstream did.
    description: row.description ? sanitizeRichText(row.description) : null,
    excerpt: row.excerpt,
    coverImageUrl: withBaseMaybe(row.cover_image_url),
    location: row.location,
    isOnline: row.is_online ?? false,
    meetingUrl: row.meeting_url,
    videoLink: row.video_link,
    documentUrl: withBaseMaybe(row.document_url),
    talkToken: row.nextcloud_talk_token,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    isRsvpEnabled: row.is_rsvp_enabled ?? false,
    rsvpDeadline: row.rsvp_deadline,
    attendeeLimit: row.attendee_limit,
    recurrencePattern: row.recurrence_pattern,
    authorId: row.author_id,
    authorName: row.author_name,
    authorPhoto: row.author_photo,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    nextOccurrenceAt: row.scheduled_at
      ? nextOccurrence(row.scheduled_at, row.recurrence_pattern, row.duration_minutes)
      : null,
    bookTitle: row.book_title,
    bookAuthor: row.book_author,
    // Read as text and parsed here: a ::int cast in SQL would turn one bad
    // metadata value into a failed query for the whole list.
    currentPage: row.current_page && /^\d+$/.test(row.current_page) ? Number(row.current_page) : null,
    endsOn: row.recurrence_until,
    pagesFrom: row.pages_from && /^\d+$/.test(row.pages_from) ? Number(row.pages_from) : null,
    pagesTo: row.pages_to && /^\d+$/.test(row.pages_to) ? Number(row.pages_to) : null,
    // Written only by addSessionNote, which admits /api/media/ or https; checked
    // again here because metadata is writable from other surfaces too.
    recordingUrl:
      row.recording_url && /^(\/api\/media\/|https:\/\/)/.test(row.recording_url)
        ? withBase(row.recording_url)
        : null,
  };
}

/**
 * Published, publicly visible threads only — the filter every public read
 * shares. `threads` is a shared namespace: kinds like `writing` and `document`
 * live in it too, and OFF_FEED_KINDS is the one list that keeps them off a
 * site's feeds. Without it a member's own blog post could lead the home page.
 * (Suggestions — kind `idea` — stay out by being ORGANIZATION-visible.)
 */
const PUBLIC_FILTER = db`
  t.org_id = ${ORG}
  AND t.status = 'published'
  AND t.visibility = 'PUBLIC'
  AND t.kind <> ALL(${OFF_FEED_KINDS})
`;

/** Upcoming or undated; a meeting stays listed until 6h past its start. */
const UPCOMING_FILTER = db`
  (t.scheduled_at IS NULL OR t.scheduled_at >= NOW() - INTERVAL '6 hours'
   OR (t.recurrence_pattern IS NOT NULL AND t.recurrence_pattern <> 'NONE'))
`;

export async function getThreadsForFeed(feedSlug: string, limit = 30): Promise<Thread[]> {
  try {
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE ${PUBLIC_FILTER} AND t.section = ${feedSlug}
      ORDER BY t.scheduled_at ASC NULLS LAST,
               COALESCE(t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map(mapThread);
  } catch (err) {
    console.error(`[fourthway] getThreadsForFeed(${feedSlug}):`, err);
    return [];
  }
}

export async function getUpcomingThreads(limit = 12): Promise<Thread[]> {
  try {
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE ${PUBLIC_FILTER} AND ${UPCOMING_FILTER}
        AND t.scheduled_at IS NOT NULL
        AND (t.recurrence_until IS NULL OR t.recurrence_until >= NOW())
      ORDER BY t.scheduled_at ASC
      LIMIT ${limit}
    `;
    return rows.map(mapThread);
  } catch (err) {
    console.error("[fourthway] getUpcomingThreads:", err);
    return [];
  }
}

/**
 * The circle's reading groups that are still sitting, soonest first.
 *
 * A group is a `reading_group` thread: the durable thing people join, not one
 * evening of it. It is "active" until its recurrence_until passes; a group with
 * no end date runs until someone gives it one.
 */
export async function getReadingGroups(limit = 12): Promise<Thread[]> {
  try {
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE ${PUBLIC_FILTER}
        AND t.kind = ${READING_GROUP_KIND}
        AND (t.recurrence_until IS NULL OR t.recurrence_until >= NOW())
      LIMIT ${limit}
    `;
    // Sorted in JS: "soonest" is the rolled-forward occurrence, which SQL
    // does not know (the cycle math lives in @elkdonis/utils).
    return rows.map(mapThread).sort(
      (a, b) => (a.nextOccurrenceAt?.getTime() ?? Infinity) - (b.nextOccurrenceAt?.getTime() ?? Infinity)
    );
  } catch (err) {
    console.error("[fourthway] getReadingGroups:", err);
    return [];
  }
}

/** Groups whose end date has passed — the /groups page lists them as finished. */
export async function getFinishedGroups(limit = 12): Promise<Thread[]> {
  try {
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE ${PUBLIC_FILTER}
        AND t.kind = ${READING_GROUP_KIND}
        AND t.recurrence_until < NOW()
      ORDER BY t.recurrence_until DESC
      LIMIT ${limit}
    `;
    return rows.map(mapThread);
  } catch (err) {
    console.error("[fourthway] getFinishedGroups:", err);
    return [];
  }
}

/**
 * The group the front page is built around: the active reading group that
 * sits soonest. Falls back to any upcoming gathering (a one-off event still
 * deserves the card), then to the latest published thread, so a circle that
 * has gone quiet has a card rather than a hole.
 */
export async function getCurrentGroupThread(): Promise<Thread | null> {
  const groups = await getReadingGroups(6);
  if (groups[0]) return groups[0];

  const upcoming = await getUpcomingThreads(8);
  const dated = upcoming
    .filter((t) => t.nextOccurrenceAt)
    .sort((a, b) => a.nextOccurrenceAt!.getTime() - b.nextOccurrenceAt!.getTime());
  if (dated[0]) return dated[0];

  try {
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE ${PUBLIC_FILTER}
      ORDER BY COALESCE(t.published_at, t.created_at) DESC
      LIMIT 1
    `;
    return rows[0] ? mapThread(rows[0]) : null;
  } catch (err) {
    console.error("[fourthway] getCurrentGroupThread:", err);
    return null;
  }
}

/**
 * What a group's sittings have left behind, newest first.
 *
 * Sessions are NOT rows made in advance. One exists only once it holds
 * something — notes, the pages covered, a recording — and then it is an
 * ordinary `post` that the group `produced` (thread_gathers, migration 131).
 * No session kind: a note about an evening is a post, and staying one keeps it
 * in the archive, the forum and search without any of them learning a word.
 */
export async function getSessionNotes(groupId: string, limit = 40): Promise<SessionNote[]> {
  try {
    const rows = await db<Array<{
      id: string; title: string; slug: string | null; section: string | null; excerpt: string | null;
      held_on: string | null; pages_from: string | null; pages_to: string | null; recording_url: string | null;
    }>>`
      SELECT t.id, t.title, t.slug, t.section, t.excerpt,
             t.metadata->>'heldOn'       AS held_on,
             t.metadata->>'pagesFrom'    AS pages_from,
             t.metadata->>'pagesTo'      AS pages_to,
             t.metadata->>'recordingUrl' AS recording_url
      FROM thread_gathers g
      JOIN threads t ON t.id = g.target_thread_id
      WHERE g.thread_id = ${groupId}
        AND g.relation = 'produced'
        AND ${PUBLIC_FILTER}
      ORDER BY COALESCE(t.metadata->>'heldOn', t.created_at::text) DESC
      LIMIT ${limit}
    `;
    const n = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : null);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      href: `/${r.section ?? "archive"}/${r.slug ?? r.id}`,
      heldOn: r.held_on,
      pagesFrom: n(r.pages_from),
      pagesTo: n(r.pages_to),
      recordingUrl: withBaseMaybe(r.recording_url),
      excerpt: r.excerpt,
    }));
  } catch (err) {
    console.error(`[fourthway] getSessionNotes(${groupId}):`, err);
    return [];
  }
}

export async function getThreadBySlug(feedSlug: string, slug: string): Promise<Thread | null> {
  try {
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE ${PUBLIC_FILTER}
        -- A thread with no section is linked under /groups (see threadHref),
        -- and one with no slug is linked by id.
        AND (t.section = ${feedSlug} OR (t.section IS NULL AND ${feedSlug} = 'groups'))
        AND (t.slug = ${slug} OR t.id = ${slug})
      LIMIT 1
    `;
    return rows[0] ? mapThread(rows[0]) : null;
  } catch (err) {
    console.error(`[fourthway] getThreadBySlug(${feedSlug}/${slug}):`, err);
    return null;
  }
}

/** Everything this org has, published or not — the /manage listing. Editors only. */
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
    console.error("[fourthway] getAllThreadsForOrg:", err);
    return [];
  }
}

/**
 * Confirmed RSVPs for a thread, for the "N attending" line.
 *
 * Delegates to the shared primitive rather than counting here: the confirmed
 * status is 'yes' (not 'going'), and thread-rsvp.ts is the one place that
 * knows it. The wrapper only adds the fail-soft contract this file keeps.
 */
export async function getAttendanceCount(threadId: string): Promise<number> {
  try {
    return await countConfirmedRsvps(threadId);
  } catch (err) {
    console.error(`[fourthway] getAttendanceCount(${threadId}):`, err);
    return 0;
  }
}

/** Whether this viewer has said yes to this thread. */
export async function isGoing(threadId: string, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  try {
    return (await getRsvpStatus(threadId, userId)) === "yes";
  } catch (err) {
    console.error(`[fourthway] isGoing(${threadId}):`, err);
    return false;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Site copy.

   Everything below reads org_site_sections (migration 041's table, the IFAC
   precedent): one jsonb blob per section_key, edited from /manage. The book
   itself lives there rather than in its own table on purpose — it is copy
   about one book, not a library, and a schema for it would have to be guessed
   before anyone has typed a page in.
   ──────────────────────────────────────────────────────────────────────────── */

export async function getSiteSections(): Promise<SiteSections> {
  try {
    const rows = await db<{ section_key: string; content: unknown }[]>`
      SELECT section_key, content FROM org_site_sections WHERE org_id = ${ORG}
    `;
    const out: SiteSections = {};
    for (const row of rows) {
      if (row.content && typeof row.content === "object") {
        out[row.section_key] = row.content as Record<string, unknown>;
      }
    }
    return out;
  } catch (err) {
    console.error("[fourthway] getSiteSections:", err);
    return {};
  }
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * The book the circle is on, from section_key `current_book`.
 *
 * Returns null when nothing has been entered — the hero then drops its paper
 * slide rather than showing an empty page, which is the honest state for a
 * site whose book has not been transcribed yet.
 */
export function readCurrentBook(sections: SiteSections): CurrentBook | null {
  const raw = sections.current_book;
  if (!raw) return null;
  const title = str(raw.title);
  if (!title) return null;

  const pages: BookPage[] = Array.isArray(raw.pages)
    ? raw.pages
        .map((p, i): BookPage | null => {
          if (!p || typeof p !== "object") return null;
          const page = p as Record<string, unknown>;
          const paragraphs = Array.isArray(page.paragraphs)
            ? page.paragraphs.filter((s): s is string => typeof s === "string" && s.trim() !== "")
            : typeof page.text === "string"
              ? page.text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
              : [];
          if (paragraphs.length === 0) return null;
          return {
            number: num(page.number) ?? i + 1,
            paragraphs,
            chapter: str(page.chapter),
          };
        })
        .filter((p): p is BookPage => p !== null)
    : [];

  return {
    title,
    author: str(raw.author),
    coverUrl: withBaseMaybe(str(raw.coverUrl)),
    edition: str(raw.edition),
    blurb: str(raw.blurb),
    review: str(raw.review),
    reviewSource: str(raw.reviewSource),
    currentPage: num(raw.currentPage) ?? pages[0]?.number ?? null,
    totalPages: num(raw.totalPages),
    pages,
  };
}

export function readSuggestedBooks(sections: SiteSections): SuggestedBook[] {
  const raw = sections.suggested_books?.items;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b): SuggestedBook | null => {
      if (!b || typeof b !== "object") return null;
      const item = b as Record<string, unknown>;
      const title = str(item.title);
      if (!title) return null;
      return {
        title,
        author: str(item.author),
        href: str(item.href),
        note: str(item.note),
      };
    })
    .filter((b): b is SuggestedBook => b !== null);
}

export function readMeetingStructure(sections: SiteSections): MeetingStructure | null {
  const raw = sections.meeting_structure;
  if (!raw) return null;
  const body = str(raw.body);
  if (!body) return null;
  return {
    title: str(raw.title) ?? "Structure of a Meeting",
    body,
    documentUrl: withBaseMaybe(str(raw.documentUrl)),
    documentLabel: str(raw.documentLabel) ?? "Download the handout",
    mediaUrl: withBaseMaybe(str(raw.mediaUrl)),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Media.
   ──────────────────────────────────────────────────────────────────────────── */

const VIDEO_EXT = /\.(mp4|webm|ogv|mov|m4v)$/i;

/**
 * Recorded meetings, from the org's Videos folder in Nextcloud.
 *
 * listOrgFiles goes out over the service account, which can read every org's
 * tree — it is NOT an access boundary. What makes this safe to call from a
 * public page is that it is pinned to Media/Videos under this org's root,
 * which is the folder the org publishes from; anything the circle wants
 * private belongs in Private/, which this never touches.
 */
export async function getMeetingRecordings(limit = 12): Promise<MeetingRecording[]> {
  try {
    const files = await listOrgFiles(ORG, "Media/Videos");
    return files
      .filter((f) => !f.isFolder && (VIDEO_EXT.test(f.name) || f.mimeType?.startsWith("video/")))
      .sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""))
      .slice(0, limit)
      .map((f) => ({
        id: f.path,
        // Filenames are timestamped on upload; strip the suffix and the
        // extension so the picker reads as a list of meetings, not of files.
        title: f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]\d{6,}$/i, "").replace(/[_-]+/g, " "),
        url: withBase(f.url),
        mimeType: f.mimeType,
        recordedAt: f.lastModified,
        sizeBytes: f.size,
      }));
  } catch (err) {
    console.error("[fourthway] getMeetingRecordings:", err);
    return [];
  }
}

/**
 * What bobs along the full-width shelf: the org's public images, plus the
 * covers of the books coming up. A book with no cover image is drawn.
 */
export async function getShelfItems(
  suggested: SuggestedBook[],
  book: CurrentBook | null,
  limit = 16
): Promise<ShelfItem[]> {
  const items: ShelfItem[] = [];

  if (book) {
    items.push({
      id: "current-book",
      title: book.title,
      imageUrl: book.coverUrl,
      author: book.author,
      href: "/books",
      kind: "book",
      subtitle: "Reading now",
    });
  }

  try {
    const media = await listOrgMediaLibrary(ORG, { type: "image", limit: 40 });
    for (const m of media) {
      // Private/ never reaches a public shelf, whatever the library returns.
      if (m.url.includes("/Private/")) continue;
      items.push({
        id: m.url,
        title: m.filename.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " "),
        imageUrl: withBase(m.url),
        href: null,
        kind: "art",
        subtitle: null,
      });
    }
  } catch (err) {
    console.error("[fourthway] getShelfItems(media):", err);
  }

  // Books ahead join the shelf with a drawn cloth cover — a suggestion is a
  // title and an author, and that is enough to draw one.
  for (const s of suggested) {
    items.push({
      id: `suggested:${s.title}`,
      title: s.title,
      imageUrl: null,
      author: s.author,
      href: s.href,
      kind: "book",
      subtitle: s.author,
    });
  }

  return items.slice(0, limit);
}

/**
 * A line from the book to close the page on.
 *
 * listCenterQuotes also returns the COLLECTIVE's quotes (org_id NULL) as a
 * fallback — right for /center, wrong here: this slot is captioned as a line
 * from the book being read, and the first render put an Elkdonis manifesto
 * line in it. Only this circle's own quotes qualify; none means the honest
 * empty state.
 */
export async function getReadingQuote(): Promise<Quote | null> {
  const quotes = (await listCenterQuotes(ORG, { limit: 24 }).catch(() => [] as Quote[])).filter(
    (q) => q.orgId === ORG
  );
  if (quotes.length === 0) return null;
  // Rotates by the day rather than at random, so a reload doesn't reshuffle
  // the page under someone mid-read but the quote still changes.
  const day = Math.floor(Date.now() / 86_400_000);
  return quotes[day % quotes.length];
}

/** Past gatherings and published writing, newest first; `q` matches title or body. */
export async function getArchive(q: string | null, limit = 60): Promise<Thread[]> {
  try {
    // Escape LIKE's own wildcards so a search for "100%" means the characters.
    const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE ${PUBLIC_FILTER}
        AND (t.scheduled_at IS NULL OR t.scheduled_at < NOW())
        AND (t.recurrence_pattern IS NULL OR t.recurrence_pattern = 'NONE')
        AND ${like ? db`(t.title ILIKE ${like} OR t.body ILIKE ${like})` : db`TRUE`}
      ORDER BY COALESCE(t.scheduled_at, t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map(mapThread);
  } catch (err) {
    console.error("[fourthway] getArchive:", err);
    return [];
  }
}
