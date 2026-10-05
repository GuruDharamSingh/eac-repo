import { db } from '@elkdonis/db';
import { deriveExcerpt, sanitizePostBody } from '@elkdonis/utils';
import { ensureUniqueThreadSlug as ensureUniqueSlug } from './thread-slug';
import { nanoid } from 'nanoid';

// ============================================================================
// Service offerings — things a person sells (workshop seats, one-on-one
// readings, lessons). A service is threads.kind='service' plus its
// workshop_pages sidecar (pricing, registration state, media slots — the
// table is workshop-named but structurally an offering page, so services
// reuse it rather than adding a parallel one).
//
// Org-agnostic by construction, same posture as org-feeds.ts: every function
// takes orgId. This is the layer a second app (music lessons, astrology
// readings) reuses unchanged — only its site config and UI differ.
//
// Booking type (one_on_one | group | async) rides in threads.metadata; it's
// presentational only today. Services are never RSVP'd — payment via
// commerce_order (see @elkdonis/commerce's createThreadOrder) is the
// registration, so is_rsvp_enabled is always false here.
//
// This is the one write path for services on every site, ArtDirect included
// (2026-09-27): a person's own services are homed in `oad` and saved here
// with `authorOnly`, so they carry the same sidecar and book the same way.
// The compose surface's answer keys (booking_type, sliding_scale, …) are
// translated in serviceInputFromAnswers / serviceAnswersFromOffering below,
// once, rather than by an adapter in each app.
//
// Reads are fail-soft (log + empty/null) — the convention shared with every
// other public read layer in this monorepo.
// ============================================================================

export type BookingType = 'one_on_one' | 'group' | 'async';
export type ServiceFormat = 'in_person' | 'online' | 'hybrid';
export type RegistrationStatus = 'open' | 'waitlist' | 'full' | 'closed';

export interface ServiceOffering {
  id: string;
  orgId: string;
  slug: string;
  title: string;
  subtitle: string | null;
  descriptionShort: string | null;
  body: string | null;
  status: 'draft' | 'published' | 'archived' | 'scheduled';
  visibility: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY';
  section: string | null;
  bookingType: BookingType | null;
  format: ServiceFormat | null;
  price: number | null;
  currency: string;
  priceSlidingMin: number | null;
  slidingScaleNote: string | null;
  registrationStatus: RegistrationStatus;
  sessionCount: number | null;
  sessionDurationHrs: number | null;
  recurrenceLabel: string | null;
  location: string | null;
  coverImageUrl: string | null;
  bannerImageUrl: string | null;
  heroMediaUrl: string | null;
  heroMediaType: 'image' | 'video' | null;
  authorId: string | null;
  shareToNetwork: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export interface ServiceOfferingInput {
  title: string;
  subtitle?: string | null;
  descriptionShort?: string | null;
  body?: string | null;
  bookingType: BookingType;
  format?: ServiceFormat | null;
  price: number;
  currency?: string;
  priceSlidingMin?: number | null;
  slidingScaleNote?: string | null;
  registrationStatus?: RegistrationStatus;
  sessionCount?: number | null;
  sessionDurationHrs?: number | null;
  recurrenceLabel?: string | null;
  location?: string | null;
  coverImageUrl?: string | null;
  bannerImageUrl?: string | null;
  status: 'draft' | 'published';
  visibility?: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY';
  /** org_feeds slug this offering appears under. Defaults to 'services'; null files it nowhere. */
  section?: string | null;
  /** threads.share_to_network. Left unchanged when omitted. */
  shareToNetwork?: boolean;
}

type Row = Record<string, unknown>;

const COLUMNS = db`
  t.id, t.org_id, t.slug, t.title, t.body, t.status, t.visibility, t.section,
  t.metadata, t.price, t.currency, t.format, t.author_id, t.share_to_network,
  t.published_at, t.updated_at,
  wp.subtitle, wp.description_short,
  wp.price_sliding_min, wp.sliding_scale_note, wp.registration_status,
  wp.session_count, wp.session_duration_hrs, wp.recurrence_label,
  wp.location_address, wp.cover_image_url, wp.banner_image_url,
  wp.hero_media_url, wp.hero_media_type
`;

function mapOffering(row: Row): ServiceOffering {
  const metadata = (row.metadata as Record<string, unknown>) ?? {};
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    slug: (row.slug as string) ?? (row.id as string),
    title: row.title as string,
    subtitle: (row.subtitle as string | null) ?? null,
    descriptionShort: (row.description_short as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    status: row.status as ServiceOffering['status'],
    visibility: row.visibility as ServiceOffering['visibility'],
    section: (row.section as string | null) ?? null,
    bookingType: (metadata.bookingType as BookingType | undefined) ?? null,
    format: (row.format as ServiceFormat | null) ?? null,
    price: row.price != null ? Number(row.price) : null,
    currency: (row.currency as string | null) ?? 'CAD',
    priceSlidingMin: row.price_sliding_min != null ? Number(row.price_sliding_min) : null,
    slidingScaleNote: (row.sliding_scale_note as string | null) ?? null,
    registrationStatus: (row.registration_status as RegistrationStatus | null) ?? 'open',
    sessionCount: row.session_count != null ? Number(row.session_count) : null,
    sessionDurationHrs: row.session_duration_hrs != null ? Number(row.session_duration_hrs) : null,
    recurrenceLabel: (row.recurrence_label as string | null) ?? null,
    location: (row.location_address as string | null) ?? null,
    coverImageUrl:
      (row.cover_image_url as string | null) ?? (metadata.coverImageUrl as string | undefined) ?? null,
    bannerImageUrl: (row.banner_image_url as string | null) ?? null,
    heroMediaUrl: (row.hero_media_url as string | null) ?? null,
    heroMediaType: (row.hero_media_type as 'image' | 'video' | null) ?? null,
    authorId: (row.author_id as string | null) ?? null,
    shareToNetwork: Boolean(row.share_to_network),
    publishedAt: (row.published_at as string | null) ?? null,
    updatedAt: row.updated_at as string,
  };
}

/** Published, publicly visible services for an org, newest first. */
export async function listServiceOfferings(
  orgId: string,
  options: { includeUnpublished?: boolean } = {}
): Promise<ServiceOffering[]> {
  try {
    const rows = (await db`
      SELECT ${COLUMNS}
      FROM threads t
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.org_id = ${orgId} AND t.kind = 'service'
        ${
          options.includeUnpublished
            ? db``
            : db`AND t.status = 'published' AND t.visibility = 'PUBLIC'`
        }
      ORDER BY COALESCE(t.published_at, t.created_at) DESC
    `) as unknown as Row[];
    return rows.map(mapOffering);
  } catch (err) {
    console.error(`[service-offerings] listServiceOfferings(${orgId}):`, err);
    return [];
  }
}

export async function getServiceOffering(orgId: string, slug: string): Promise<ServiceOffering | null> {
  try {
    const [row] = (await db`
      SELECT ${COLUMNS}
      FROM threads t
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.org_id = ${orgId} AND t.kind = 'service'
        AND (t.slug = ${slug} OR t.id = ${slug})
        AND t.status = 'published' AND t.visibility = 'PUBLIC'
      LIMIT 1
    `) as unknown as Row[];
    return row ? mapOffering(row) : null;
  } catch (err) {
    console.error(`[service-offerings] getServiceOffering(${orgId}, ${slug}):`, err);
    return null;
  }
}

/** Any service in the org by id, regardless of status — for /manage. */
export async function getServiceOfferingById(orgId: string, id: string): Promise<ServiceOffering | null> {
  try {
    const [row] = (await db`
      SELECT ${COLUMNS}
      FROM threads t
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.org_id = ${orgId} AND t.kind = 'service' AND t.id = ${id}
        AND t.status <> 'archived'
      LIMIT 1
    `) as unknown as Row[];
    return row ? mapOffering(row) : null;
  } catch (err) {
    console.error(`[service-offerings] getServiceOfferingById(${orgId}, ${id}):`, err);
    return null;
  }
}

/** All services for an org, any status — the /manage dashboard list. */
export async function listAllServiceOfferingsForOrg(orgId: string): Promise<ServiceOffering[]> {
  try {
    const rows = (await db`
      SELECT ${COLUMNS}
      FROM threads t
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.org_id = ${orgId} AND t.kind = 'service' AND t.status <> 'archived'
      ORDER BY t.updated_at DESC
    `) as unknown as Row[];
    return rows.map(mapOffering);
  } catch (err) {
    console.error(`[service-offerings] listAllServiceOfferingsForOrg(${orgId}):`, err);
    return [];
  }
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'service'
  );
}


/**
 * Create or update a service offering. Caller is responsible for
 * authorisation (check hasOrgRole first) — this only writes.
 *
 * `authorOnly` restricts an update to a service `authorId` wrote, for homes
 * where every member is a plain member and authorship is the only right to
 * edit (ArtDirect's `oad`). An id that fails the check is "not found".
 */
export async function upsertServiceOffering(
  orgId: string,
  authorId: string,
  input: ServiceOfferingInput,
  threadId?: string,
  options: { authorOnly?: boolean } = {}
): Promise<{ id: string; slug: string }> {
  const section = input.section === undefined ? 'services' : input.section;
  const slug = await ensureUniqueSlug(orgId, slugify(input.title), threadId);
  const publishedAt = input.status === 'published' ? new Date() : null;
  // Feeds and cards read the cover from metadata->>'coverImageUrl' (threads
  // has no column), so it is written there as well as to the sidecar.
  const metadata: Record<string, string> = { bookingType: input.bookingType };
  if (input.coverImageUrl) metadata.coverImageUrl = input.coverImageUrl;
  // sanitizePostBody keeps <eac-embed> markers, as createThread does.
  const body = sanitizePostBody(input.body ?? '');
  const excerpt = input.descriptionShort?.trim() || deriveExcerpt(body) || null;
  const shareToNetwork = input.shareToNetwork ?? null;

  const id = threadId ?? nanoid(21);

  await db.begin(async (tx) => {
    if (threadId) {
      const [existing] = await tx<{ id: string }[]>`
        SELECT id FROM threads
        WHERE id = ${threadId} AND org_id = ${orgId}
          ${options.authorOnly ? tx`AND author_id = ${authorId} AND kind = 'service'` : tx``}
        LIMIT 1
      `;
      if (!existing) throw new Error('Service not found');

      // Metadata is merged, not assigned: other features write keys there.
      // The cover key is dropped first so clearing the image clears it.
      await tx`
        UPDATE threads SET
          kind          = 'service',
          section       = ${section},
          title         = ${input.title},
          slug          = ${slug},
          body          = ${body || null},
          excerpt       = ${excerpt},
          status        = ${input.status},
          visibility    = ${input.visibility ?? 'PUBLIC'},
          metadata      = (COALESCE(metadata, '{}'::jsonb) - 'coverImageUrl') || ${tx.json(metadata)},
          price         = ${input.price},
          currency      = ${input.currency ?? 'CAD'},
          format        = ${input.format ?? null},
          share_to_network = COALESCE(${shareToNetwork}::boolean, share_to_network),
          is_rsvp_enabled = FALSE,
          published_at  = COALESCE(published_at, ${publishedAt}),
          updated_at    = NOW()
        WHERE id = ${threadId} AND org_id = ${orgId}
      `;
    } else {
      await tx`
        INSERT INTO threads (
          id, org_id, author_id, kind, section, title, slug, body, excerpt,
          status, visibility, metadata, price, currency, format,
          share_to_network, is_rsvp_enabled, published_at
        ) VALUES (
          ${id}, ${orgId}, ${authorId}, 'service', ${section},
          ${input.title}, ${slug}, ${body || null}, ${excerpt},
          ${input.status}, ${input.visibility ?? 'PUBLIC'}, ${tx.json(metadata)},
          ${input.price}, ${input.currency ?? 'CAD'}, ${input.format ?? null},
          ${shareToNetwork ?? false}, FALSE, ${publishedAt}
        )
      `;
    }

    await tx`
      INSERT INTO workshop_pages (
        thread_id, subtitle, description_short,
        price_sliding_min, sliding_scale_note, registration_status,
        session_count, session_duration_hrs, recurrence_label,
        location_address, cover_image_url, banner_image_url
      ) VALUES (
        ${id}, ${input.subtitle || null}, ${input.descriptionShort || null},
        ${input.priceSlidingMin ?? null}, ${input.slidingScaleNote || null},
        ${input.registrationStatus ?? 'open'},
        ${input.sessionCount ?? null}, ${input.sessionDurationHrs ?? null}, ${input.recurrenceLabel || null},
        ${input.location || null}, ${input.coverImageUrl || null}, ${input.bannerImageUrl || null}
      )
      ON CONFLICT (thread_id) DO UPDATE SET
        subtitle              = EXCLUDED.subtitle,
        description_short     = EXCLUDED.description_short,
        price_sliding_min      = EXCLUDED.price_sliding_min,
        sliding_scale_note     = EXCLUDED.sliding_scale_note,
        registration_status    = EXCLUDED.registration_status,
        session_count          = EXCLUDED.session_count,
        session_duration_hrs   = EXCLUDED.session_duration_hrs,
        recurrence_label       = EXCLUDED.recurrence_label,
        location_address       = EXCLUDED.location_address,
        cover_image_url        = EXCLUDED.cover_image_url,
        banner_image_url       = EXCLUDED.banner_image_url
    `;
  });

  return { id, slug };
}

/**
 * Take a service down for good. Archives rather than deletes: a service that
 * was ever booked is referenced by commerce_order_line.thread_id, and a
 * DELETE would cascade its replies and gathers away (threads rule, 2026-09-27).
 */
export async function deleteServiceOffering(orgId: string, threadId: string): Promise<boolean> {
  try {
    const [row] = await db<{ id: string }[]>`
      UPDATE threads SET status = 'archived', updated_at = NOW()
      WHERE id = ${threadId} AND org_id = ${orgId} AND kind = 'service'
      RETURNING id
    `;
    return !!row;
  } catch (err) {
    console.error(`[service-offerings] deleteServiceOffering(${orgId}, ${threadId}):`, err);
    return false;
  }
}

// ── The compose surface's vocabulary ─────────────────────────────────────────
// `@elkdonis/cms-ui/compose` declares a service's fields once
// (buildContentFields('service')) and names them as the columns do. These two
// functions are the only translation between those answers and this layer,
// so every host — hidden-enneagram, elastrocal, ArtDirect — saves and edits a
// service the same way.

const BOOKING_TYPES: readonly BookingType[] = ['one_on_one', 'group', 'async'];
const FORMATS: readonly ServiceFormat[] = ['in_person', 'online', 'hybrid'];
const REGISTRATION: readonly RegistrationStatus[] = ['open', 'waitlist', 'full', 'closed'];

function answerStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}
function answerNum(v: unknown): number | null {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function pick<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const s = answerStr(v);
  return (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

/**
 * Compose answers → a service to save. Unknown or malformed values fall back
 * to the defaults rather than failing, except where {@link validateServiceInput}
 * says otherwise. `feed_slug` becomes the section when present.
 */
export function serviceInputFromAnswers(
  answers: Record<string, unknown>,
  status: 'draft' | 'published'
): ServiceOfferingInput {
  const price = Math.max(0, answerNum(answers.price) ?? 0);
  const sliding = answers.sliding_scale === true || answers.sliding_scale === 'true';
  const floor = sliding ? answerNum(answers.price_sliding_min) : null;
  const count = answerNum(answers.session_count);
  const hours = answerNum(answers.session_duration_hrs);
  const visibility = answerStr(answers.visibility);
  const feed = answerStr(answers.feed_slug);
  return {
    title: answerStr(answers.title),
    subtitle: answerStr(answers.subtitle) || null,
    descriptionShort: answerStr(answers.excerpt) || null,
    body: typeof answers.body === 'string' ? answers.body : null,
    bookingType: pick(answers.booking_type, BOOKING_TYPES) ?? 'one_on_one',
    format: pick(answers.format, FORMATS),
    price,
    currency: (answerStr(answers.currency) || 'CAD').toUpperCase().slice(0, 3),
    priceSlidingMin: floor != null && floor >= 0 ? floor : null,
    slidingScaleNote: sliding ? answerStr(answers.sliding_scale_note) || null : null,
    registrationStatus: pick(answers.registration_status, REGISTRATION) ?? 'open',
    sessionCount: count != null && count >= 1 ? Math.round(count) : null,
    sessionDurationHrs: hours != null && hours > 0 ? hours : null,
    recurrenceLabel: answerStr(answers.recurrence_label) || null,
    location: answerStr(answers.location) || null,
    coverImageUrl: answerStr(answers.cover_image_url) || null,
    bannerImageUrl: answerStr(answers.banner_image_url) || null,
    status,
    visibility:
      visibility === 'ORGANIZATION' || visibility === 'INVITE_ONLY' ? visibility : 'PUBLIC',
    ...(feed ? { section: feed } : {}),
    ...(answers.share_to_network !== undefined
      ? { shareToNetwork: answers.share_to_network === true || answers.share_to_network === 'true' }
      : {}),
  };
}

/** What stops a service from saving, in words for the author; null when it can. */
export function validateServiceInput(input: ServiceOfferingInput): string | null {
  if (!input.title.trim()) return 'Give it a title.';
  if (input.priceSlidingMin != null && input.priceSlidingMin > input.price) {
    return 'The lowest sliding-scale amount cannot be above the price.';
  }
  return null;
}

/**
 * A saved service → the compose answers that are not shared thread columns
 * (hosts pass this as `SurfaceThread.extra`; cms-ui's defaultThreadToAnswers
 * reads it back for kind 'service').
 */
export function serviceAnswersFromOffering(o: ServiceOffering): Record<string, unknown> {
  return {
    subtitle: o.subtitle ?? '',
    booking_type: o.bookingType ?? 'one_on_one',
    sliding_scale: o.priceSlidingMin != null,
    price_sliding_min: o.priceSlidingMin ?? undefined,
    sliding_scale_note: o.slidingScaleNote ?? '',
    registration_status: o.registrationStatus,
    session_count: o.sessionCount ?? undefined,
    session_duration_hrs: o.sessionDurationHrs ?? undefined,
    recurrence_label: o.recurrenceLabel ?? '',
    location: o.location ?? '',
    banner_image_url: o.bannerImageUrl ?? '',
    share_to_network: o.shareToNetwork,
  };
}

/** "CA$80", "CA$40–80", "Free" — one price line for cards and pages. */
export function servicePriceLabel(o: {
  price: number | null;
  currency: string | null;
  priceSlidingMin: number | null;
}): string | null {
  if (o.price == null) return null;
  if (o.price === 0) return 'Free';
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: o.currency || 'CAD', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  return o.priceSlidingMin != null && o.priceSlidingMin < o.price
    ? `${fmt(o.priceSlidingMin)}–${fmt(o.price)}`
    : fmt(o.price);
}
