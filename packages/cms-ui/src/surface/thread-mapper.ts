import type { SurfaceSession, SurfaceThread } from "./types";

// ============================================================================
// A host's Thread view-model → the shared SurfaceThread.
//
// Three sites (amrit-canada, innergathering, hidden-enneagram) each carried
// their own `lib/surface-thread.ts` doing this mapping — 229 lines, two of
// them byte-identical and the third differing only in nulling the scheduling
// fields it has no columns for. Consolidated here because the mapping itself
// (coerce dates to ISO strings, apply the per-request extras) is the same
// everywhere; what genuinely differs per host — its URL scheme for `href`,
// how it derives `format` from its own online/location columns, and any
// extra fields its own `threadToAnswers` reads back — stays host-supplied,
// as plain fields on the input rather than logic this function has to branch
// on.
//
// `ThreadMapperInput` is deliberately WIDE: everything but the always-present
// core fields is optional, so a site whose Thread type has no scheduling
// columns at all (hidden-enneagram publishes only writing and offerings)
// satisfies it without maintaining a subset type of its own — a Thread that
// never HAS a `scheduledAt` property is assignable wherever the parameter
// only ever OPTIONALLY reads one.
// ============================================================================

export interface ThreadMapperInput {
  id: string;
  title: string;
  slug: string;
  kind: string;
  status: string;
  visibility: string;
  excerpt: string | null;
  /** This host's rich-text body column, whatever it is called locally. */
  bodyHtml: string | null;
  coverImageUrl: string | null;
  authorName: string | null;
  authorPhoto: string | null;
  publishedAt: Date | string | null;

  scheduledAt?: Date | string | null;
  /** The occurrence in play for a recurring thread. */
  nextOccurrenceAt?: Date | string | null;
  durationMinutes?: number | null;
  location?: string | null;
  /** Already derived from this host's own online/location columns — this
   *  function does not guess a format from them. */
  format?: string | null;
  meetingUrl?: string | null;
  talkToken?: string | null;
  recurrencePattern?: string | null;
  recurrenceUntil?: Date | string | null;

  isRsvpEnabled?: boolean;
  attendeeLimit?: number | null;
  rsvpDeadline?: Date | string | null;

  documentUrl?: string | null;
  videoLink?: string | null;

  /** This host's own URL for the thread, e.g. `/{feedSlug}/{slug}`. */
  href?: string | null;
}

export interface ThreadMapperExtras {
  feed?: { slug: string; name: string } | null;
  rsvpCount?: number;
  viewerAttending?: boolean | null;
  cycleStatus?: SurfaceThread["cycleStatus"];
  price?: SurfaceThread["price"];
  currency?: string | null;
  sessions?: SurfaceSession[] | null;
  /** Merged onto `SurfaceThread.extra` — a host's own fields for its own
   *  `threadToAnswers`, e.g. a time zone or a minimum-attendance setting. */
  extra?: Record<string, unknown>;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * One mapping, used by a host's hub API route (for popups) and its detail
 * page (for the page-size surface), so the popup and the page cannot
 * disagree about what a piece of content is. The surface never sees a host's
 * column names.
 */
export function toSurfaceThread(
  thread: ThreadMapperInput,
  extras: ThreadMapperExtras = {}
): SurfaceThread {
  return {
    id: thread.id,
    title: thread.title,
    slug: thread.slug,
    kind: thread.kind,
    status: thread.status,
    visibility: thread.visibility,
    feed: extras.feed ?? null,
    excerpt: thread.excerpt,
    bodyHtml: thread.bodyHtml,
    coverImageUrl: thread.coverImageUrl,
    author: { name: thread.authorName, photo: thread.authorPhoto },
    publishedAt: iso(thread.publishedAt),
    scheduledAt: iso(thread.scheduledAt),
    nextOccurrenceAt: iso(thread.nextOccurrenceAt),
    durationMinutes: thread.durationMinutes ?? null,
    location: thread.location ?? null,
    format: thread.format ?? null,
    meetingUrl: thread.meetingUrl ?? null,
    talkToken: thread.talkToken ?? null,
    recurrencePattern: thread.recurrencePattern ?? null,
    recurrenceUntil: iso(thread.recurrenceUntil),
    cycleStatus: extras.cycleStatus ?? null,
    isRsvpEnabled: thread.isRsvpEnabled ?? false,
    attendeeLimit: thread.attendeeLimit ?? null,
    rsvpDeadline: iso(thread.rsvpDeadline),
    rsvpCount: extras.rsvpCount ?? 0,
    viewerAttending: extras.viewerAttending ?? null,
    price: extras.price ?? null,
    currency: extras.currency ?? null,
    sessions: extras.sessions ?? null,
    documentUrl: thread.documentUrl ?? null,
    videoLink: thread.videoLink ?? null,
    href: thread.href ?? null,
    extra: extras.extra ?? {},
  };
}
