/** Shapes the pages render. The DB's column naming stops at src/lib/data.ts. */

export interface Thread {
  id: string;
  title: string;
  slug: string;
  kind: string;
  feedSlug: string | null;
  status: string;
  visibility: string;
  description: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  location: string | null;
  isOnline: boolean;
  meetingUrl: string | null;
  videoLink: string | null;
  documentUrl: string | null;
  talkToken: string | null;
  scheduledAt: Date | null;
  durationMinutes: number | null;
  isRsvpEnabled: boolean;
  rsvpDeadline: Date | null;
  attendeeLimit: number | null;
  recurrencePattern: string | null;
  authorId: string | null;
  authorName: string | null;
  authorPhoto: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  /** The occurrence a visitor is actually looking at; rolls forward each cycle. */
  nextOccurrenceAt: Date | null;

  /* ── Reading groups only (kind = 'reading_group'); null on everything else.
     The thread IS the group: these ride in threads.metadata, and the group's
     roster is its 'yes' RSVPs. ─────────────────────────────────────────── */
  /** The book this group is reading — may differ from the site's lead book. */
  bookTitle: string | null;
  bookAuthor: string | null;
  /** The page THIS group has reached. Two groups can be at different places. */
  currentPage: number | null;
  /** When the group disbands (threads.recurrence_until), if it has an end. */
  endsOn: Date | null;

  /* ── Session notes only (a `post` a group produced). ── */
  pagesFrom: number | null;
  pagesTo: number | null;
  recordingUrl: string | null;
}

/** The kind behind a reading group. Registered in services' SCHEDULED_KINDS. */
export const READING_GROUP_KIND = "reading_group";

/** What one sitting of a group left behind — a `post` the group `produced`. */
export interface SessionNote {
  id: string;
  title: string;
  href: string;
  heldOn: string | null;
  pagesFrom: number | null;
  pagesTo: number | null;
  recordingUrl: string | null;
  excerpt: string | null;
}

/** One page of the book being read, as it is shown on the paper in the hero. */
export interface BookPage {
  /** Page number as printed in the edition, not an array index. */
  number: number;
  /** Paragraphs. Plain text — the paper renders it, nothing interprets markup. */
  paragraphs: string[];
  /** Optional chapter heading that opens on this page. */
  chapter?: string | null;
}

/** The book the circle is currently reading. */
export interface CurrentBook {
  title: string;
  author: string | null;
  /** Cover image URL (usually /api/media/...), or null for the drawn fallback. */
  coverUrl: string | null;
  edition: string | null;
  blurb: string | null;
  /** A single line of praise shown under the blurb on the hero's book slide. */
  review: string | null;
  reviewSource: string | null;
  /** Where the circle has reached. */
  currentPage: number | null;
  totalPages: number | null;
  /** Pages transcribed for the paper surface, in reading order. */
  pages: BookPage[];
}

/** A hyperlinked suggestion in the "books ahead" list. */
export interface SuggestedBook {
  title: string;
  author: string | null;
  href: string | null;
  note: string | null;
}

/** Editable copy + attachments for the "Structure of a Meeting" section. */
export interface MeetingStructure {
  title: string;
  /** Rich text (HTML) as saved by the shared editor. Sanitised on write. */
  body: string;
  /** An optional handout: a document in the org's cloud folder. */
  documentUrl: string | null;
  documentLabel: string | null;
  /** An optional image/diagram shown beside the text. */
  mediaUrl: string | null;
}

/** One item bobbing along the full-width carousel. */
export interface ShelfItem {
  id: string;
  title: string;
  /** Image to show; null means draw a cover from the title (books only). */
  imageUrl: string | null;
  author?: string | null;
  href: string | null;
  /** What it is, for the caption line. */
  kind: "art" | "product" | "book";
  subtitle: string | null;
}

/** A recorded meeting from the org's cloud folder. */
export interface MeetingRecording {
  id: string;
  title: string;
  /** Platform URL (/api/media/...), never a Nextcloud URL. */
  url: string;
  mimeType: string | null;
  recordedAt: string | null;
  sizeBytes: number;
}

/** Freeform per-key site copy from org_site_sections. */
export type SiteSections = Record<string, Record<string, unknown>>;
