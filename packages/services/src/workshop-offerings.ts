import { db } from '@elkdonis/db';
import { ensureUniqueThreadSlug as ensureUniqueSlug } from './thread-slug';
import { nanoid } from 'nanoid';

// ============================================================================
// Workshop offerings — the org-agnostic read/write layer for workshops.
//
// Deliberately mirrors service-offerings.ts: same posture (every function
// takes orgId), same fail-soft reads, same workshop_pages sidecar. The two
// are siblings because they're the same database shape:
//
//   service  — threads.kind='service',  paid, no RSVP; the commerce_order
//              IS the registration (see @elkdonis/commerce).
//   workshop — threads.kind='workshop', RSVP-based, plus workshop_sessions
//              rows, a Nextcloud materials folder, and a shared Talk room.
//
// This is the layer every app reuses unchanged — inner-gathering (Mantine),
// hidden-enneagram / amrit-canada / arts-collective (shadcn) all differ only
// in their form UI and site config, not in how a workshop is stored.
//
// Price is written to BOTH threads.price and workshop_pages.price_member on
// purpose: inner-gathering's existing readers (its detail page and the paid
// join route) resolve price as COALESCE(wp.price_member, t.price), while
// service-offerings and the newer apps read threads.price. Writing both
// keeps a workshop authored in any app readable by all of them.
// ============================================================================

export type WorkshopFormat = 'in_person' | 'online' | 'hybrid';
export type RegistrationStatus = 'open' | 'waitlist' | 'full' | 'closed';
export type WorkshopLevel = 'all_levels' | 'beginner' | 'intermediate' | 'advanced';

/**
 * Gallery entries as stored in workshop_pages.gallery_image_urls. Shape is
 * fixed by the template manifest's eac-ws-gallery section.
 * Type alias, not interface — see WorkshopSessionResource below for why.
 */
export type WorkshopGalleryItem = {
  url: string;
  alt?: string;
  caption?: string;
};

/**
 * A type alias, not an interface, on purpose: postgres.js's `JSONValue`
 * constraint requires an implicit index signature, which interfaces don't
 * get. As an interface this fails to typecheck when passed to tx.json().
 */
export type WorkshopSessionResource = {
  id: string;
  title: string;
  type: 'link' | 'pdf' | 'video' | 'audio' | 'doc' | 'other';
  url: string;
  isPublic: boolean;
  description?: string;
};

export interface WorkshopSession {
  id: string;
  sessionNumber: number;
  title: string;
  description: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  isOnline: boolean;
  location: string;
  videoConferenceUrl: string;
  mediaUrl: string | null;
  videoUrl: string | null;
  backgroundColor: string | null;
  resources: WorkshopSessionResource[];
}

export interface WorkshopSessionInput {
  title: string;
  description?: string;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  isOnline?: boolean;
  location?: string;
  videoConferenceUrl?: string;
  mediaUrl?: string | null;
  videoUrl?: string | null;
  backgroundColor?: string | null;
  resources?: WorkshopSessionResource[];
}

export interface WorkshopOffering {
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
  format: WorkshopFormat | null;
  price: number | null;
  currency: string;
  priceSlidingMin: number | null;
  priceMember: number | null;
  slidingScaleNote: string | null;
  registrationStatus: RegistrationStatus;
  registrationUrl: string | null;
  registrationDeadline: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  location: string | null;
  locationAddress: string | null;
  recurrenceLabel: string | null;
  // Descriptive / taxonomy — drives the template's eyebrow and detail strip
  discipline: string | null;
  seriesLabel: string | null;
  level: WorkshopLevel | null;
  language: string;
  sessionCount: number | null;
  sessionDurationHrs: number | null;
  accessibilityNotes: string | null;
  authorNote: string | null;
  attendeeLimit: number | null;
  rsvpDeadline: string | null;
  minAttendees: number | null;
  reminderMinutesBefore: number | null;
  // Media slots
  coverImageUrl: string | null;
  bannerImageUrl: string | null;
  bannerFocalY: number;
  heroMediaUrl: string | null;
  heroMediaType: 'image' | 'video' | null;
  heroText: string | null;
  backgroundColor: string | null;
  galleryImageUrls: WorkshopGalleryItem[];
  promoVideoUrl: string | null;
  // SEO / social
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  // Template presentation — section visibility toggles and CSS var overrides
  optionalSections: Record<string, boolean>;
  themeOverrides: Record<string, string>;
  // Integrations
  nextcloudTalkToken: string | null;
  authorId: string | null;
  publishedAt: string | null;
  updatedAt: string;
  sessions: WorkshopSession[];
}

export interface WorkshopOfferingInput {
  title: string;
  subtitle?: string | null;
  descriptionShort?: string | null;
  body?: string | null;
  format?: WorkshopFormat | null;
  price?: number | null;
  currency?: string;
  priceSlidingMin?: number | null;
  /** Member price. Defaults to `price` when omitted. */
  priceMember?: number | null;
  slidingScaleNote?: string | null;
  registrationStatus?: RegistrationStatus;
  registrationUrl?: string | null;
  registrationDeadline?: string | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  location?: string | null;
  /** Full street address. Falls back to `location` when omitted. */
  locationAddress?: string | null;
  recurrenceLabel?: string | null;
  discipline?: string | null;
  seriesLabel?: string | null;
  level?: WorkshopLevel | null;
  language?: string;
  sessionCount?: number | null;
  sessionDurationHrs?: number | null;
  accessibilityNotes?: string | null;
  authorNote?: string | null;
  attendeeLimit?: number | null;
  rsvpDeadline?: string | null;
  minAttendees?: number | null;
  reminderMinutesBefore?: number | null;
  coverImageUrl?: string | null;
  bannerImageUrl?: string | null;
  bannerFocalY?: number | null;
  heroMediaUrl?: string | null;
  heroMediaType?: 'image' | 'video' | null;
  heroText?: string | null;
  backgroundColor?: string | null;
  galleryImageUrls?: WorkshopGalleryItem[];
  promoVideoUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  /**
   * Per-section visibility, keyed by template manifest section id
   * (e.g. `eac-ws-gallery`). Sections the manifest marks required are
   * rendered regardless.
   */
  optionalSections?: Record<string, boolean>;
  /** CSS custom property overrides, e.g. `--eac-ws-hero-bg`. */
  themeOverrides?: Record<string, string>;
  status: 'draft' | 'published';
  visibility?: 'PUBLIC' | 'ORGANIZATION';
  /** org_feeds slug this workshop appears under. Defaults to 'workshops'. */
  section?: string;
  sessions?: WorkshopSessionInput[];
}

type Row = Record<string, unknown>;

const COLUMNS = db`
  t.id, t.org_id, t.slug, t.title, t.body, t.excerpt, t.status, t.visibility, t.section,
  t.price, t.currency, t.format, t.author_id, t.published_at, t.updated_at,
  t.scheduled_at, t.duration_minutes, t.location,
  t.attendee_limit, t.rsvp_deadline, t.min_attendees, t.reminder_minutes_before,
  t.nextcloud_talk_token,
  wp.subtitle, wp.description_short, wp.price_member,
  wp.price_sliding_min, wp.sliding_scale_note, wp.registration_status,
  wp.recurrence_label, wp.location_address,
  wp.registration_url, wp.registration_deadline,
  wp.discipline, wp.series_label, wp.level, wp.language,
  wp.session_count, wp.session_duration_hrs,
  wp.accessibility_notes, wp.author_note,
  wp.cover_image_url, wp.banner_image_url, wp.banner_focal_y,
  wp.hero_media_url, wp.hero_media_type, wp.hero_text, wp.background_color,
  wp.gallery_image_urls, wp.promo_video_url,
  wp.seo_title, wp.seo_description, wp.og_image_url,
  wp.optional_sections, wp.theme_overrides
`;

/**
 * workshop_sessions.notes is JSONB, but a past bug double-encoded it for some
 * rows (JSON.stringify passed into a driver that already serializes objects
 * for jsonb columns), leaving a jsonb *string* of JSON text. Normalize either
 * shape so old rows keep working without a data backfill.
 */
function parseJsonb<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as T) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function parseSessionNotes(raw: unknown): Record<string, any> {
  return parseJsonb<Record<string, any>>(raw, {});
}

function mapSession(row: Row): WorkshopSession {
  const notes = parseSessionNotes(row.notes);
  return {
    id: row.id as string,
    sessionNumber: Number(row.session_number ?? 1),
    title: (row.topic as string) ?? '',
    description: notes.description ?? '',
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at as string).toISOString() : null,
    durationMinutes: row.duration_minutes != null ? Number(row.duration_minutes) : null,
    isOnline: notes.isOnline ?? true,
    location: notes.location ?? '',
    videoConferenceUrl: notes.videoConferenceUrl ?? '',
    mediaUrl: notes.mediaUrl ?? null,
    videoUrl: notes.videoUrl ?? null,
    backgroundColor: notes.backgroundColor ?? null,
    resources: notes.resources ?? [],
  };
}

function mapOffering(row: Row, sessions: WorkshopSession[] = []): WorkshopOffering {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    slug: (row.slug as string) ?? (row.id as string),
    title: row.title as string,
    subtitle: (row.subtitle as string | null) ?? null,
    descriptionShort:
      (row.description_short as string | null) ?? (row.excerpt as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    status: row.status as WorkshopOffering['status'],
    visibility: row.visibility as WorkshopOffering['visibility'],
    section: (row.section as string | null) ?? null,
    format: (row.format as WorkshopFormat | null) ?? null,
    // price_member is inner-gathering's canonical read; fall back to threads.price.
    price:
      row.price_member != null
        ? Number(row.price_member)
        : row.price != null
          ? Number(row.price)
          : null,
    currency: (row.currency as string | null) ?? 'CAD',
    priceSlidingMin: row.price_sliding_min != null ? Number(row.price_sliding_min) : null,
    priceMember: row.price_member != null ? Number(row.price_member) : null,
    slidingScaleNote: (row.sliding_scale_note as string | null) ?? null,
    registrationStatus: (row.registration_status as RegistrationStatus | null) ?? 'open',
    registrationUrl: (row.registration_url as string | null) ?? null,
    registrationDeadline: row.registration_deadline
      ? new Date(row.registration_deadline as string).toISOString()
      : null,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at as string).toISOString() : null,
    durationMinutes: row.duration_minutes != null ? Number(row.duration_minutes) : null,
    location: (row.location as string | null) ?? (row.location_address as string | null) ?? null,
    locationAddress: (row.location_address as string | null) ?? null,
    recurrenceLabel: (row.recurrence_label as string | null) ?? null,
    discipline: (row.discipline as string | null) ?? null,
    seriesLabel: (row.series_label as string | null) ?? null,
    level: (row.level as WorkshopLevel | null) ?? null,
    language: (row.language as string | null) ?? 'English',
    sessionCount: row.session_count != null ? Number(row.session_count) : null,
    sessionDurationHrs:
      row.session_duration_hrs != null ? Number(row.session_duration_hrs) : null,
    accessibilityNotes: (row.accessibility_notes as string | null) ?? null,
    authorNote: (row.author_note as string | null) ?? null,
    attendeeLimit: row.attendee_limit != null ? Number(row.attendee_limit) : null,
    rsvpDeadline: row.rsvp_deadline ? new Date(row.rsvp_deadline as string).toISOString() : null,
    minAttendees: row.min_attendees != null ? Number(row.min_attendees) : null,
    reminderMinutesBefore:
      row.reminder_minutes_before != null ? Number(row.reminder_minutes_before) : null,
    coverImageUrl: (row.cover_image_url as string | null) ?? null,
    bannerImageUrl: (row.banner_image_url as string | null) ?? null,
    bannerFocalY: row.banner_focal_y != null ? Number(row.banner_focal_y) : 50,
    heroMediaUrl: (row.hero_media_url as string | null) ?? null,
    heroMediaType: (row.hero_media_type as 'image' | 'video' | null) ?? null,
    heroText: (row.hero_text as string | null) ?? null,
    backgroundColor: (row.background_color as string | null) ?? null,
    galleryImageUrls: parseJsonb<WorkshopGalleryItem[]>(row.gallery_image_urls, []),
    promoVideoUrl: (row.promo_video_url as string | null) ?? null,
    seoTitle: (row.seo_title as string | null) ?? null,
    seoDescription: (row.seo_description as string | null) ?? null,
    ogImageUrl: (row.og_image_url as string | null) ?? null,
    optionalSections: parseJsonb<Record<string, boolean>>(row.optional_sections, {}),
    themeOverrides: parseJsonb<Record<string, string>>(row.theme_overrides, {}),
    nextcloudTalkToken: (row.nextcloud_talk_token as string | null) ?? null,
    authorId: (row.author_id as string | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    updatedAt: row.updated_at as string,
    sessions,
  };
}

async function loadSessions(threadId: string): Promise<WorkshopSession[]> {
  const rows = (await db`
    SELECT id, session_number, topic, scheduled_at, duration_minutes, notes
    FROM workshop_sessions
    WHERE thread_id = ${threadId}
    ORDER BY session_number ASC
  `) as unknown as Row[];
  return rows.map(mapSession);
}

/** Published, publicly visible workshops for an org, newest first. Sessions omitted (list view). */
export async function listWorkshopOfferings(
  orgId: string,
  limit: number = 50
): Promise<WorkshopOffering[]> {
  try {
    const rows = (await db`
      SELECT ${COLUMNS}
      FROM threads t
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.org_id = ${orgId}
        AND t.kind = 'workshop'
        AND t.status = 'published'
        AND t.visibility = 'PUBLIC'
      ORDER BY COALESCE(t.scheduled_at, t.published_at, t.updated_at) DESC
      LIMIT ${limit}
    `) as unknown as Row[];
    return rows.map((r) => mapOffering(r));
  } catch (err) {
    console.error(`[workshop-offerings] listWorkshopOfferings(${orgId}):`, err);
    return [];
  }
}

/** Every workshop for an org regardless of status — the authoring/manage list. */
export async function listAllWorkshopOfferingsForOrg(orgId: string): Promise<WorkshopOffering[]> {
  try {
    const rows = (await db`
      SELECT ${COLUMNS}
      FROM threads t
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.org_id = ${orgId} AND t.kind = 'workshop'
      ORDER BY t.updated_at DESC
    `) as unknown as Row[];
    return rows.map((r) => mapOffering(r));
  } catch (err) {
    console.error(`[workshop-offerings] listAllWorkshopOfferingsForOrg(${orgId}):`, err);
    return [];
  }
}

/** One workshop by slug, with its sessions. Public read (published only). */
export async function getWorkshopOffering(
  orgId: string,
  slug: string
): Promise<WorkshopOffering | null> {
  try {
    const [row] = (await db`
      SELECT ${COLUMNS}
      FROM threads t
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.org_id = ${orgId} AND t.kind = 'workshop' AND t.slug = ${slug}
        AND t.status = 'published'
      LIMIT 1
    `) as unknown as Row[];
    if (!row) return null;
    return mapOffering(row, await loadSessions(row.id as string));
  } catch (err) {
    console.error(`[workshop-offerings] getWorkshopOffering(${orgId}, ${slug}):`, err);
    return null;
  }
}

/**
 * One workshop by id with its sessions, at ANY status — this is the read the
 * edit form uses, so it must return drafts. Authorization is the caller's
 * job (check hasOrgRole first); the orgId argument scopes it, nothing more.
 */
export async function getWorkshopOfferingById(
  orgId: string,
  threadId: string
): Promise<WorkshopOffering | null> {
  try {
    const [row] = (await db`
      SELECT ${COLUMNS}
      FROM threads t
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.org_id = ${orgId} AND t.kind = 'workshop' AND t.id = ${threadId}
      LIMIT 1
    `) as unknown as Row[];
    if (!row) return null;
    return mapOffering(row, await loadSessions(row.id as string));
  } catch (err) {
    console.error(`[workshop-offerings] getWorkshopOfferingById(${orgId}, ${threadId}):`, err);
    return null;
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
      .slice(0, 80) || 'workshop'
  );
}


/**
 * Create or update a workshop, with its sessions. Caller is responsible for
 * authorisation (check hasOrgRole first) — this only writes.
 *
 * Draft-safe: pass status:'draft' with a partial input and an existing
 * threadId to keep updating the same row, which is what a resumable
 * create-wizard needs. published_at is only ever set forward (COALESCE), so
 * re-saving a published workshop as a draft doesn't lose its original
 * publish date.
 *
 * Sessions are replaced wholesale when `sessions` is provided, and left
 * untouched when it's undefined — so a wizard step that doesn't cover
 * sessions can save without wiping them.
 */
export async function upsertWorkshopOffering(
  orgId: string,
  authorId: string,
  input: WorkshopOfferingInput,
  threadId?: string
): Promise<{ id: string; slug: string }> {
  const section = input.section ?? 'workshops';
  const slug = await ensureUniqueSlug(orgId, slugify(input.title), threadId);
  const publishedAt = input.status === 'published' ? new Date() : null;
  const id = threadId ?? nanoid(21);
  const price = input.price ?? null;
  // price_member is inner-gathering's canonical read; when the caller does not
  // distinguish a member rate, it mirrors the headline price.
  const priceMember = input.priceMember ?? price;

  await db.begin(async (tx) => {
    if (threadId) {
      const [existing] = await tx<{ id: string }[]>`
        SELECT id FROM threads WHERE id = ${threadId} AND org_id = ${orgId} LIMIT 1
      `;
      if (!existing) throw new Error('Workshop not found');

      await tx`
        UPDATE threads SET
          kind            = 'workshop',
          section         = ${section},
          title           = ${input.title},
          slug            = ${slug},
          body            = ${input.body || null},
          excerpt         = ${input.descriptionShort || null},
          status          = ${input.status},
          visibility      = ${input.visibility ?? 'PUBLIC'},
          price           = ${price},
          currency        = ${input.currency ?? 'CAD'},
          format          = ${input.format ?? null},
          scheduled_at    = ${input.scheduledAt ? new Date(input.scheduledAt) : null},
          duration_minutes = ${input.durationMinutes ?? null},
          location        = ${input.location || null},
          attendee_limit  = ${input.attendeeLimit ?? null},
          rsvp_deadline   = ${input.rsvpDeadline ? new Date(input.rsvpDeadline) : null},
          min_attendees   = ${input.minAttendees ?? null},
          reminder_minutes_before = ${input.reminderMinutesBefore ?? 60},
          is_rsvp_enabled = TRUE,
          published_at    = COALESCE(published_at, ${publishedAt}),
          updated_at      = NOW()
        WHERE id = ${threadId} AND org_id = ${orgId}
      `;
    } else {
      await tx`
        INSERT INTO threads (
          id, org_id, author_id, kind, section, title, slug, body, excerpt,
          status, visibility, price, currency, format,
          scheduled_at, duration_minutes, location,
          attendee_limit, rsvp_deadline, min_attendees, reminder_minutes_before,
          is_rsvp_enabled, published_at
        ) VALUES (
          ${id}, ${orgId}, ${authorId}, 'workshop', ${section},
          ${input.title}, ${slug}, ${input.body || null}, ${input.descriptionShort || null},
          ${input.status}, ${input.visibility ?? 'PUBLIC'},
          ${price}, ${input.currency ?? 'CAD'}, ${input.format ?? null},
          ${input.scheduledAt ? new Date(input.scheduledAt) : null},
          ${input.durationMinutes ?? null}, ${input.location || null},
          ${input.attendeeLimit ?? null},
          ${input.rsvpDeadline ? new Date(input.rsvpDeadline) : null},
          ${input.minAttendees ?? null}, ${input.reminderMinutesBefore ?? 60},
          TRUE, ${publishedAt}
        )
      `;
    }

    await tx`
      INSERT INTO workshop_pages (
        thread_id, subtitle, description_short, price_member,
        price_sliding_min, sliding_scale_note, registration_status,
        registration_url, registration_deadline,
        recurrence_label, location_address,
        discipline, series_label, level, language,
        session_count, session_duration_hrs,
        accessibility_notes, author_note,
        cover_image_url, banner_image_url, banner_focal_y,
        hero_media_url, hero_media_type, hero_text, background_color,
        gallery_image_urls, promo_video_url,
        seo_title, seo_description, og_image_url,
        optional_sections, theme_overrides
      ) VALUES (
        ${id}, ${input.subtitle || null}, ${input.descriptionShort || null}, ${priceMember},
        ${input.priceSlidingMin ?? null}, ${input.slidingScaleNote || null},
        ${input.registrationStatus ?? 'open'},
        ${input.registrationUrl || null},
        ${input.registrationDeadline ? new Date(input.registrationDeadline) : null},
        ${input.recurrenceLabel || null},
        ${input.locationAddress ?? input.location ?? null},
        ${input.discipline || null}, ${input.seriesLabel || null},
        ${input.level ?? null}, ${input.language ?? 'English'},
        ${input.sessionCount ?? null}, ${input.sessionDurationHrs ?? null},
        ${input.accessibilityNotes || null}, ${input.authorNote || null},
        ${input.coverImageUrl || null}, ${input.bannerImageUrl || null},
        ${input.bannerFocalY ?? 50},
        ${input.heroMediaUrl || null},
        ${input.heroMediaUrl ? (input.heroMediaType ?? 'image') : null},
        ${input.heroText || null}, ${input.backgroundColor || null},
        ${tx.json(input.galleryImageUrls ?? [])}, ${input.promoVideoUrl || null},
        ${input.seoTitle || null}, ${input.seoDescription || null},
        ${input.ogImageUrl || null},
        ${tx.json(input.optionalSections ?? {})},
        ${tx.json(input.themeOverrides ?? {})}
      )
      ON CONFLICT (thread_id) DO UPDATE SET
        subtitle            = EXCLUDED.subtitle,
        description_short   = EXCLUDED.description_short,
        price_member        = EXCLUDED.price_member,
        price_sliding_min   = EXCLUDED.price_sliding_min,
        sliding_scale_note  = EXCLUDED.sliding_scale_note,
        registration_status = EXCLUDED.registration_status,
        registration_url    = EXCLUDED.registration_url,
        registration_deadline = EXCLUDED.registration_deadline,
        recurrence_label    = EXCLUDED.recurrence_label,
        location_address    = EXCLUDED.location_address,
        discipline          = EXCLUDED.discipline,
        series_label        = EXCLUDED.series_label,
        level               = EXCLUDED.level,
        language            = EXCLUDED.language,
        session_count       = EXCLUDED.session_count,
        session_duration_hrs = EXCLUDED.session_duration_hrs,
        accessibility_notes = EXCLUDED.accessibility_notes,
        author_note         = EXCLUDED.author_note,
        cover_image_url     = EXCLUDED.cover_image_url,
        banner_image_url    = EXCLUDED.banner_image_url,
        banner_focal_y      = EXCLUDED.banner_focal_y,
        hero_media_url      = EXCLUDED.hero_media_url,
        hero_media_type     = EXCLUDED.hero_media_type,
        hero_text           = EXCLUDED.hero_text,
        background_color    = EXCLUDED.background_color,
        gallery_image_urls  = EXCLUDED.gallery_image_urls,
        promo_video_url     = EXCLUDED.promo_video_url,
        seo_title           = EXCLUDED.seo_title,
        seo_description     = EXCLUDED.seo_description,
        og_image_url        = EXCLUDED.og_image_url,
        optional_sections   = EXCLUDED.optional_sections,
        theme_overrides     = EXCLUDED.theme_overrides
    `;

    // Sessions: replace wholesale, but only when the caller supplied them.
    // A wizard step that doesn't touch sessions passes undefined and keeps
    // whatever is already stored.
    if (input.sessions) {
      await tx`DELETE FROM workshop_sessions WHERE thread_id = ${id}`;
      for (const [i, s] of input.sessions.entries()) {
        // tx.json() rather than JSON.stringify — the driver serializes for
        // jsonb itself, and pre-stringifying double-encodes it into a jsonb
        // *string*, which silently breaks every notes.* read back out.
        const notes = {
          description: s.description ?? '',
          isOnline: s.isOnline ?? true,
          location: s.location ?? '',
          videoConferenceUrl: s.videoConferenceUrl ?? '',
          mediaUrl: s.mediaUrl ?? null,
          videoUrl: s.videoUrl ?? null,
          resources: s.resources ?? [],
          backgroundColor: s.backgroundColor ?? null,
        };
        await tx`
          INSERT INTO workshop_sessions (
            id, thread_id, session_number, topic, scheduled_at, duration_minutes, notes
          ) VALUES (
            ${`ws_${nanoid(16)}`}, ${id}, ${i + 1}, ${s.title},
            ${s.scheduledAt ? new Date(s.scheduledAt) : null},
            ${s.durationMinutes ?? null}, ${tx.json(notes)}
          )
        `;
      }
    }
  });

  return { id, slug };
}

/** Archive a workshop — takes it off public feeds, keeps it in the author's list. */
export async function archiveWorkshopOffering(orgId: string, threadId: string): Promise<boolean> {
  try {
    const [row] = await db<{ id: string }[]>`
      UPDATE threads SET status = 'archived', updated_at = NOW()
      WHERE id = ${threadId} AND org_id = ${orgId} AND kind = 'workshop'
      RETURNING id
    `;
    return !!row;
  } catch (err) {
    console.error(`[workshop-offerings] archiveWorkshopOffering(${orgId}, ${threadId}):`, err);
    return false;
  }
}

/**
 * Is this person in this workshop?
 *
 * Enrolment lives in two tables and always has: a free signup is an RSVP of
 * 'yes', a paid one is a `workshop_join_requests` row that reached 'paid'.
 * Either counts. This is the rule inner-gathering repeats inline in its page,
 * its materials listing and its file download — three copies of a security
 * check is two too many, so anything gating workshop content calls this.
 *
 * Deliberately excludes owner/guide: running a workshop is not the same
 * question as being enrolled in it, and callers that want both should say so
 * (`isEnrolledInWorkshop(...) || canEditOrgIdentity(...)`), which keeps
 * "should I see a Join button" answerable separately from "may I read this".
 */
export async function isEnrolledInWorkshop(
  threadId: string,
  userId: string
): Promise<boolean> {
  try {
    const [row] = await db<{ ok: number }[]>`
      SELECT 1 AS ok FROM thread_rsvps
      WHERE thread_id = ${threadId} AND user_id = ${userId} AND status = 'yes'
      UNION ALL
      SELECT 1 AS ok FROM workshop_join_requests
      WHERE workshop_id = ${threadId} AND user_id = ${userId} AND status = 'paid'
      LIMIT 1
    `;
    return Boolean(row);
  } catch (err) {
    console.error(`[workshop-offerings] isEnrolledInWorkshop(${threadId}, ${userId}):`, err);
    return false;
  }
}

export async function deleteWorkshopOffering(orgId: string, threadId: string): Promise<boolean> {
  try {
    const [row] = await db<{ id: string }[]>`
      DELETE FROM threads WHERE id = ${threadId} AND org_id = ${orgId} AND kind = 'workshop'
      RETURNING id
    `;
    return !!row;
  } catch (err) {
    console.error(`[workshop-offerings] deleteWorkshopOffering(${orgId}, ${threadId}):`, err);
    return false;
  }
}
