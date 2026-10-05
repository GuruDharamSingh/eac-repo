/**
 * A person's offerings on ArtDirect — threads they author, homed in `oad`.
 *
 * Decisions (developer, 2026-09-27; docs/open/ARTIST_FUNNEL_BRIEF_2026-09-27.md):
 *  - An artist offers things as themselves, without an org. The kinds, for
 *    now: meeting and service. Writing stays the existing blog
 *    (writing.ts, off the network feeds by design); artwork waits for
 *    commerce (it needs an active store); workshops are left out for now.
 *  - One offering is featured and gets its own page (/<slug>/featured,
 *    users.featured_thread_id, migration 171); the rest are cards on the
 *    profile.
 *  - Network sharing is on unless the person opts out when publishing
 *    (threads.share_to_network).
 *  - The person who authored it edits it. Checks here are by author, not org
 *    role: in `oad` every artist is a plain member.
 *
 * Creating an org does not carry these over (decision 6).
 *
 * A service is saved by service-offerings.ts's upsertServiceOffering, the
 * same path every org site uses (2026-09-27): it writes the workshop_pages
 * sidecar (booking type, sliding scale, registration), so a personal service
 * books through createThreadOrder exactly as an org's does. Meetings stay
 * here.
 */

import { nanoid } from 'nanoid';
import { db } from '@elkdonis/db';
import { deriveExcerpt, sanitizePostBody } from '@elkdonis/utils';
import { ensureUniqueThreadSlug } from './thread-slug';
import { ARTIST_SPACE_ORG_ID, markArtist } from './artist-membership';
import { upsertServiceOffering, validateServiceInput, type ServiceOfferingInput } from './service-offerings';

export const OFFERING_KINDS = ['meeting', 'service'] as const;
export type OfferingKind = (typeof OFFERING_KINDS)[number];

export function isOfferingKind(kind: string): kind is OfferingKind {
  return (OFFERING_KINDS as readonly string[]).includes(kind);
}

const DEFAULT_TIME_ZONE = 'America/Toronto';

export interface OfferingInput {
  kind: OfferingKind;
  title: string;
  body?: string | null;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  status: 'draft' | 'published';
  /**
   * PUBLIC or INVITE_ONLY. "Members of this organisation" means every artist
   * in `oad`, which nobody means; it is stored as INVITE_ONLY.
   */
  visibility?: string | null;
  shareToNetwork: boolean;
  // Meeting
  /** Wall-clock "YYYY-MM-DDTHH:mm" in `timeZone`. */
  scheduledAt?: string | null;
  timeZone?: string | null;
  durationMinutes?: number | null;
  location?: string | null;
  format?: 'online' | 'in_person' | 'hybrid' | null;
  meetingUrl?: string | null;
  isRsvpEnabled?: boolean;
  attendeeLimit?: number | null;
  // Service
  price?: number | null;
  currency?: string | null;
  /**
   * The service's own fields (booking type, sliding scale, registration…),
   * usually from serviceInputFromAnswers. Title, status, visibility and
   * network sharing above take precedence over the same keys here.
   */
  service?: ServiceOfferingInput;
}

export interface OfferingSaveResult {
  ok: boolean;
  id?: string;
  slug?: string;
  error?: string;
}

export interface Offering {
  id: string;
  kind: OfferingKind;
  title: string;
  slug: string;
  status: string;
  visibility: string;
  excerpt: string | null;
  body: string | null;
  coverImageUrl: string | null;
  scheduledAt: Date | null;
  timeZone: string | null;
  durationMinutes: number | null;
  location: string | null;
  isOnline: boolean;
  meetingUrl: string | null;
  isRsvpEnabled: boolean;
  attendeeLimit: number | null;
  price: number | null;
  currency: string | null;
  shareToNetwork: boolean;
  publishedAt: Date | null;
  updatedAt: Date | null;
  featured: boolean;
}

/**
 * Create (no threadId) or update one of the person's offerings. An update
 * matches author, home org and kind set, so an id belonging to anyone else —
 * or to one of their org threads — is "not found", not an edit.
 */
export async function saveOffering(
  authorId: string,
  input: OfferingInput,
  threadId?: string
): Promise<OfferingSaveResult> {
  if (!isOfferingKind(input.kind)) return { ok: false, error: 'That kind of offering is not available here.' };
  const title = (input.title ?? '').trim();
  if (!title) return { ok: false, error: 'Give it a title.' };

  if (input.kind === 'service') return saveServiceOffering(authorId, title, input, threadId);

  const isMeeting = input.kind === 'meeting';
  const timeZone = isMeeting ? input.timeZone?.trim() || DEFAULT_TIME_ZONE : null;
  const scheduledAt = isMeeting ? wallClockToDate(input.scheduledAt ?? '', timeZone) : null;
  if (isMeeting && input.status === 'published' && !scheduledAt) {
    return { ok: false, error: 'A meeting needs a date and time before it is published.' };
  }

  // sanitizePostBody keeps <eac-embed> markers, as createThread does.
  const body = sanitizePostBody(input.body ?? '');
  const excerpt = input.excerpt?.trim() || deriveExcerpt(body);
  const visibility = input.visibility === 'INVITE_ONLY' || input.visibility === 'ORGANIZATION' ? 'INVITE_ONLY' : 'PUBLIC';
  const publishedAt = input.status === 'published' ? new Date() : null;
  // Services returned above; a meeting carries no price.
  const price = null;
  const currency = null;

  const metadata: Record<string, string> = {};
  if (input.coverImageUrl) metadata.coverImageUrl = input.coverImageUrl;
  if (timeZone) metadata.timeZone = timeZone;

  const orgId = ARTIST_SPACE_ORG_ID;
  const slug = await ensureUniqueThreadSlug(orgId, title, threadId);

  const meeting = {
    is_meeting: isMeeting,
    scheduled_at: scheduledAt,
    duration_minutes: isMeeting ? input.durationMinutes ?? null : null,
    location: isMeeting ? input.location?.trim() || null : null,
    is_online: isMeeting ? input.format !== 'in_person' : false,
    meeting_url: isMeeting ? input.meetingUrl?.trim() || null : null,
    is_rsvp_enabled: isMeeting ? input.isRsvpEnabled ?? true : false,
    attendee_limit: isMeeting ? input.attendeeLimit ?? null : null,
  };

  if (threadId) {
    // Metadata is merged, not replaced: other features write keys there.
    const rows = await db<Array<{ id: string }>>`
      UPDATE threads SET
        kind             = ${input.kind},
        title            = ${title},
        slug             = ${slug},
        body             = ${body || null},
        excerpt          = ${excerpt},
        status           = ${input.status},
        visibility       = ${visibility},
        share_to_network = ${input.shareToNetwork},
        metadata         = COALESCE(metadata, '{}'::jsonb) || ${db.json(metadata)},
        is_meeting       = ${meeting.is_meeting},
        scheduled_at     = ${meeting.scheduled_at},
        duration_minutes = ${meeting.duration_minutes},
        location         = ${meeting.location},
        is_online        = ${meeting.is_online},
        meeting_url      = ${meeting.meeting_url},
        is_rsvp_enabled  = ${meeting.is_rsvp_enabled},
        attendee_limit   = ${meeting.attendee_limit},
        price            = ${price},
        currency         = ${currency},
        published_at     = COALESCE(published_at, ${publishedAt}),
        updated_at       = NOW()
      WHERE id = ${threadId}
        AND org_id = ${orgId}
        AND author_id = ${authorId}
        AND kind IN ('meeting', 'service')
      RETURNING id
    `;
    if (rows.length === 0) return { ok: false, error: 'Not found' };
    return { ok: true, id: threadId, slug };
  }

  const id = nanoid(21);
  await db`
    INSERT INTO threads (
      id, org_id, author_id, kind, title, slug, body, excerpt,
      status, visibility, share_to_network, metadata,
      is_meeting, scheduled_at, duration_minutes, location, is_online,
      meeting_url, is_rsvp_enabled, attendee_limit,
      price, currency, published_at
    ) VALUES (
      ${id}, ${orgId}, ${authorId}, ${input.kind}, ${title}, ${slug}, ${body || null}, ${excerpt},
      ${input.status}, ${visibility}, ${input.shareToNetwork}, ${db.json(metadata)},
      ${meeting.is_meeting}, ${meeting.scheduled_at}, ${meeting.duration_minutes}, ${meeting.location}, ${meeting.is_online},
      ${meeting.meeting_url}, ${meeting.is_rsvp_enabled}, ${meeting.attendee_limit},
      ${price}, ${currency}, ${publishedAt}
    )
  `;
  // Offering something is using one's space; make sure it is held.
  await markArtist(authorId).catch((err) => console.error('[artist-offerings] markArtist:', err));
  return { ok: true, id, slug };
}

/**
 * A personal service, through the shared service layer. An update is limited
 * to the author's own service in `oad` (authorOnly), so any other id is
 * "not found", as for meetings above.
 */
async function saveServiceOffering(
  authorId: string,
  title: string,
  input: OfferingInput,
  threadId?: string
): Promise<OfferingSaveResult> {
  const visibility = input.visibility === 'INVITE_ONLY' || input.visibility === 'ORGANIZATION' ? 'INVITE_ONLY' : 'PUBLIC';
  const service: ServiceOfferingInput = {
    ...input.service,
    bookingType: input.service?.bookingType ?? 'one_on_one',
    title,
    body: input.body ?? input.service?.body ?? null,
    descriptionShort: input.excerpt?.trim() || input.service?.descriptionShort || null,
    coverImageUrl: input.coverImageUrl ?? input.service?.coverImageUrl ?? null,
    price: Math.max(0, Number(input.price ?? input.service?.price ?? 0) || 0),
    currency: (input.currency?.trim() || input.service?.currency || 'CAD').toUpperCase().slice(0, 3),
    format: input.format ?? input.service?.format ?? null,
    status: input.status,
    visibility,
    // No feeds in `oad`: a personal service is filed nowhere, like a meeting.
    section: null,
    shareToNetwork: input.shareToNetwork,
  };
  const invalid = validateServiceInput(service);
  if (invalid) return { ok: false, error: invalid };
  try {
    const { id, slug } = await upsertServiceOffering(ARTIST_SPACE_ORG_ID, authorId, service, threadId, {
      authorOnly: true,
    });
    if (!threadId) {
      await markArtist(authorId).catch((err) => console.error('[artist-offerings] markArtist:', err));
    }
    return { ok: true, id, slug };
  } catch (err) {
    if (err instanceof Error && err.message === 'Service not found') return { ok: false, error: 'Not found' };
    throw err;
  }
}

/** Publish or take down. Taking down the featured offering clears the feature. */
export async function setOfferingStatus(
  authorId: string,
  threadId: string,
  status: 'draft' | 'published'
): Promise<boolean> {
  const rows = await db<Array<{ id: string }>>`
    UPDATE threads SET
      status = ${status},
      published_at = CASE WHEN ${status} = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
      updated_at = NOW()
    WHERE id = ${threadId} AND org_id = ${ARTIST_SPACE_ORG_ID} AND author_id = ${authorId}
      AND kind IN ('meeting', 'service')
    RETURNING id
  `;
  if (rows.length === 0) return false;
  if (status !== 'published') {
    await db`UPDATE users SET featured_thread_id = NULL WHERE id = ${authorId} AND featured_thread_id = ${threadId}`;
  }
  return true;
}

/**
 * Make one published offering the featured one, or clear it (null). Only the
 * author's own published offerings qualify.
 */
export async function setFeaturedOffering(userId: string, threadId: string | null): Promise<boolean> {
  if (threadId === null) {
    await db`UPDATE users SET featured_thread_id = NULL, updated_at = NOW() WHERE id = ${userId}`;
    return true;
  }
  const [ok] = await db<Array<{ id: string }>>`
    SELECT id FROM threads
    WHERE id = ${threadId} AND org_id = ${ARTIST_SPACE_ORG_ID} AND author_id = ${userId}
      AND kind IN ('meeting', 'service') AND status = 'published'
    LIMIT 1
  `;
  if (!ok) return false;
  await db`UPDATE users SET featured_thread_id = ${threadId}, updated_at = NOW() WHERE id = ${userId}`;
  return true;
}

interface OfferingDbRow {
  id: string;
  kind: OfferingKind;
  title: string;
  slug: string;
  status: string;
  visibility: string;
  excerpt: string | null;
  body: string | null;
  metadata: Record<string, unknown> | null;
  scheduled_at: Date | null;
  duration_minutes: number | null;
  location: string | null;
  is_online: boolean | null;
  meeting_url: string | null;
  is_rsvp_enabled: boolean;
  attendee_limit: number | null;
  price: string | null;
  currency: string | null;
  share_to_network: boolean;
  published_at: Date | null;
  updated_at: Date | null;
  featured: boolean;
}

function toOffering(r: OfferingDbRow): Offering {
  const meta = r.metadata ?? {};
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    slug: r.slug,
    status: r.status,
    visibility: r.visibility,
    excerpt: r.excerpt,
    body: r.body,
    coverImageUrl: typeof meta.coverImageUrl === 'string' ? meta.coverImageUrl : null,
    scheduledAt: r.scheduled_at,
    timeZone: typeof meta.timeZone === 'string' ? meta.timeZone : null,
    durationMinutes: r.duration_minutes,
    location: r.location,
    isOnline: Boolean(r.is_online),
    meetingUrl: r.meeting_url,
    isRsvpEnabled: r.is_rsvp_enabled,
    attendeeLimit: r.attendee_limit,
    price: r.price == null ? null : Number(r.price),
    currency: r.currency,
    shareToNetwork: r.share_to_network,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
    featured: r.featured,
  };
}

/**
 * The person's offerings, newest first. `includeDrafts` is for the owner's
 * own panel; visitors get published PUBLIC ones only.
 */
export async function listOfferings(
  userId: string,
  opts: { includeDrafts?: boolean } = {}
): Promise<Offering[]> {
  const includeDrafts = Boolean(opts.includeDrafts);
  const rows = await db<OfferingDbRow[]>`
    SELECT t.id, t.kind, t.title, t.slug, t.status, t.visibility, t.excerpt, t.body, t.metadata,
           t.scheduled_at, t.duration_minutes, t.location, t.is_online, t.meeting_url,
           t.is_rsvp_enabled, t.attendee_limit, t.price, t.currency, t.share_to_network,
           t.published_at, t.updated_at,
           (u.featured_thread_id = t.id) IS TRUE AS featured
    FROM threads t
    JOIN users u ON u.id = t.author_id
    WHERE t.author_id = ${userId}
      AND t.org_id = ${ARTIST_SPACE_ORG_ID}
      AND t.kind IN ('meeting', 'service')
      AND t.status <> 'archived'
      AND (${includeDrafts} OR (t.status = 'published' AND t.visibility = 'PUBLIC'))
    ORDER BY t.updated_at DESC NULLS LAST
  `;
  return rows.map(toOffering);
}

/** The featured offering as a visitor may see it (published, PUBLIC), or null. */
export async function getFeaturedOffering(userId: string): Promise<Offering | null> {
  const [row] = await db<OfferingDbRow[]>`
    SELECT t.id, t.kind, t.title, t.slug, t.status, t.visibility, t.excerpt, t.body, t.metadata,
           t.scheduled_at, t.duration_minutes, t.location, t.is_online, t.meeting_url,
           t.is_rsvp_enabled, t.attendee_limit, t.price, t.currency, t.share_to_network,
           t.published_at, t.updated_at, TRUE AS featured
    FROM users u
    JOIN threads t ON t.id = u.featured_thread_id
    WHERE u.id = ${userId}
      AND t.author_id = ${userId}
      AND t.status = 'published'
      AND t.visibility = 'PUBLIC'
    LIMIT 1
  `;
  return row ? toOffering(row) : null;
}

/** One offering for its author to edit (any status except archived), or null. */
export async function getOwnOffering(authorId: string, threadId: string): Promise<Offering | null> {
  const [row] = await db<OfferingDbRow[]>`
    SELECT t.id, t.kind, t.title, t.slug, t.status, t.visibility, t.excerpt, t.body, t.metadata,
           t.scheduled_at, t.duration_minutes, t.location, t.is_online, t.meeting_url,
           t.is_rsvp_enabled, t.attendee_limit, t.price, t.currency, t.share_to_network,
           t.published_at, t.updated_at,
           (u.featured_thread_id = t.id) IS TRUE AS featured
    FROM threads t JOIN users u ON u.id = t.author_id
    WHERE t.id = ${threadId} AND t.author_id = ${authorId}
      AND t.org_id = ${ARTIST_SPACE_ORG_ID} AND t.kind IN ('meeting', 'service')
      AND t.status <> 'archived'
    LIMIT 1
  `;
  return row ? toOffering(row) : null;
}

/**
 * Wall-clock "YYYY-MM-DDTHH:mm" in a zone → the instant. Same method as
 * sunjay's zonedInputToDate (apps/sunjay/src/lib/format.ts:133): read the
 * zone's offset at that moment and correct twice across a DST edge.
 */
function wallClockToDate(value: string, timeZone: string | null): Date | null {
  if (!value) return null;
  const tz = timeZone || DEFAULT_TIME_ZONE;
  const local = value.length === 10 ? `${value}T00:00` : value.slice(0, 16);
  const asIfUtc = new Date(`${local}:00Z`);
  if (Number.isNaN(asIfUtc.getTime())) return null;
  try {
    const shifted = new Date(asIfUtc.getTime() - zoneOffsetMs(asIfUtc, tz));
    return new Date(asIfUtc.getTime() - zoneOffsetMs(shifted, tz));
  } catch {
    return asIfUtc;
  }
}

function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const hour = get('hour') === 24 ? 0 : get('hour');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return asUtc - at.getTime();
}
