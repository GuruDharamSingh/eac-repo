"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@elkdonis/db";
import { requireUser } from "@/lib/session";
import { canEditOrgSite } from "@/lib/org";
import {
  threadFormSchema,
  workshopPageSchema,
  workshopFullSchema,
  slugifyTitle,
  type ThreadFormInput,
  type WorkshopPageInput,
  type WorkshopFullInput,
} from "@/lib/cms/schema";
import { deriveExcerpt } from "@elkdonis/utils";
import {
  ensureUniqueThreadSlug,
  ensureWorkshopMaterialsFolder,
  replaceWorkshopSessions,
  resolveActor,
  upsertWorkshopOffering,
} from "@elkdonis/services";
import type { FieldTable } from "@elkdonis/cms-bindings";

export type CreateThreadResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

type OrgRow = { id: string; slug: string; name: string };

/**
 * Create a new thread (post / workshop / event) for an org the current user
 * has edit rights on. Optionally provisions a Nextcloud Talk room when the
 * workshop/event opts in.
 */
export async function createThreadAction(
  input: ThreadFormInput,
  /**
   * Sign it as one of this person's other identities — a pen name, or an
   * org's own byline (migration 132). A second argument rather than a form
   * field because it is not part of the content: the schema describes what is
   * being written, and this describes who is writing it.
   */
  options?: { actingAs?: string | null }
): Promise<CreateThreadResult> {
  const parsed = threadFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  const user = await requireUser();

  // Locate the org and authorize.
  const orgs = await db<OrgRow[]>`
    SELECT id, slug, name FROM organizations WHERE slug = ${data.orgSlug} LIMIT 1
  `;
  const org = orgs[0];
  if (!org) return { ok: false, error: "Organization not found" };

  // Permission follows the PERSON; the byline follows the identity they chose.
  // Both checks are real and neither substitutes for the other — a pen name
  // does not earn access to an org, and holding a role does not by itself let
  // you sign as the org.
  const allowed = await canEditOrgSite(user.id, org.id);
  if (!allowed) return { ok: false, error: "Not authorized" };

  const actor = await resolveActor(user.id, options?.actingAs);
  if (actor.ok === false) return { ok: false, error: actor.error };

  // Generate id and slug (with collision retry).
  const id = nanoid(21);
  const baseSlug = slugifyTitle(data.title);
  const slug = await ensureUniqueThreadSlug(org.id, baseSlug);

  const isScheduled =
    data.kind === "workshop" || data.kind === "event" || data.kind === "meeting";
  const scheduledAt =
    isScheduled && "scheduled_at" in data && data.scheduled_at
      ? new Date(data.scheduled_at)
      : null;
  const durationMinutes =
    isScheduled && "duration_minutes" in data ? data.duration_minutes ?? null : null;
  const location =
    isScheduled && "location" in data ? data.location || null : null;
  const format =
    isScheduled && "format" in data ? data.format : null;
  const meetingUrl =
    isScheduled && "meeting_url" in data ? data.meeting_url || null : null;
  const isRsvpEnabled =
    isScheduled && "is_rsvp_enabled" in data ? data.is_rsvp_enabled : false;
  const attendeeLimit =
    isScheduled && "attendee_limit" in data ? data.attendee_limit ?? null : null;

  const price =
    data.kind === "workshop" && "price" in data ? data.price ?? null : null;
  const currency =
    data.kind === "workshop" && "currency" in data ? data.currency ?? "USD" : null;
  const sessions =
    data.kind === "workshop" && "sessions" in data ? data.sessions ?? [] : [];

  const excerpt = data.excerpt || deriveExcerpt(data.body) || null;
  const publishedAt = data.status === "published" ? new Date() : null;

  // Optional Nextcloud Talk room — best-effort, never blocks creation.
  let talkToken: string | null = null;
  if ("create_talk_room" in data && data.create_talk_room) {
    try {
      talkToken = await tryCreateTalkRoom({
        userId: user.id,
        roomName: `${org.name} — ${data.title}`,
      });
    } catch (err) {
      console.warn("[cms] Talk room creation failed", err);
    }
  }

  // Cover image rides in metadata — threads has no cover_image_url column, and
  // amrit-canada's save path already uses this shape. Keeping one convention
  // matters more than the column would.
  const metadata = data.cover_image_url ? { coverImageUrl: data.cover_image_url } : {};

  await db`
    INSERT INTO threads (
      id, org_id, author_id, kind,
      title, slug, body, excerpt,
      status, visibility, share_to_network,
      scheduled_at, duration_minutes, location, format, meeting_url,
      is_rsvp_enabled, attendee_limit,
      price, currency,
      nextcloud_talk_token, nextcloud_doc_url,
      metadata,
      published_at
    ) VALUES (
      ${id}, ${org.id}, ${actor.identityId}, ${data.kind},
      ${data.title}, ${slug}, ${data.body || null}, ${excerpt},
      ${data.status}, ${data.visibility}, ${data.share_to_network},
      ${scheduledAt}, ${durationMinutes}, ${location}, ${format}, ${meetingUrl},
      ${isRsvpEnabled}, ${attendeeLimit},
      ${price}, ${currency},
      ${talkToken}, ${data.nextcloud_doc_url || null},
      ${db.json(metadata)},
      ${publishedAt}
    )
  `;

  // Sessions belong in workshop_sessions, which is where the workshop page
  // reads them. They used to go into the `threads.sessions` JSON column,
  // which nothing displays — a workshop created here arrived with its whole
  // schedule silently dropped.
  if (data.kind === "workshop" && sessions.length > 0) {
    await replaceWorkshopSessions(
      org.id,
      id,
      sessions.map((session, i) => ({
        title: session.title || `Session ${i + 1}`,
        scheduledAt: session.scheduled_at || null,
        durationMinutes: session.duration_minutes ?? null,
        location: session.location || "",
        isOnline: format !== "in_person",
        videoConferenceUrl: session.meeting_url || "",
      }))
    );
  }

  revalidatePath(`/sites/${org.slug}`);

  return { ok: true, id, slug };
}

export type TogglePinResult =
  | { ok: true; pinned: boolean }
  | { ok: false; error: string };

/**
 * Toggle the pinned state of a thread. Ensures only one pinned thread per org.
 */
export async function togglePinAction(
  threadId: string
): Promise<TogglePinResult> {
  const user = await requireUser();

  const rows = await db<
    { org_id: string; pinned: boolean; org_slug: string }[]
  >`
    SELECT t.org_id, t.pinned, o.slug AS org_slug
    FROM threads t
    JOIN organizations o ON o.id = t.org_id
    WHERE t.id = ${threadId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Thread not found" };

  const allowed = await canEditOrgSite(user.id, row.org_id);
  if (!allowed) return { ok: false, error: "Not authorized" };

  const nextPinned = !row.pinned;

  if (nextPinned) {
    // Unpin all others first to keep the single-feature invariant.
    await db`
      UPDATE threads SET pinned = false
      WHERE org_id = ${row.org_id} AND pinned = true
    `;
  }
  await db`
    UPDATE threads SET pinned = ${nextPinned} WHERE id = ${threadId}
  `;

  revalidatePath(`/sites/${row.org_slug}`);
  return { ok: true, pinned: nextPinned };
}

// ---------- helpers ----------


/**
 * Create a Nextcloud Talk room scoped to the current user. Pulled inline so
 * the @elkdonis/nextcloud import can fail soft if env vars are not set in
 * dev — we don't want a missing NEXTCLOUD_URL to break thread creation.
 */
async function tryCreateTalkRoom(args: {
  userId: string;
  roomName: string;
}): Promise<string | null> {
  const baseUrl = process.env.NEXTCLOUD_URL;
  if (!baseUrl) return null;

  const userRows = await db<
    { nextcloud_user_id: string | null; nextcloud_app_password: string | null }[]
  >`
    SELECT nextcloud_user_id, nextcloud_app_password
    FROM users WHERE id = ${args.userId} LIMIT 1
  `;
  const u = userRows[0];
  if (!u?.nextcloud_user_id || !u?.nextcloud_app_password) return null;

  const { createNextcloudClient, createTalkRoom } = await import(
    "@elkdonis/nextcloud"
  );
  const client = createNextcloudClient({
    baseUrl,
    username: u.nextcloud_user_id,
    password: u.nextcloud_app_password,
  });
  const room = await createTalkRoom(client, {
    name: args.roomName.slice(0, 200),
    type: "public",
  });
  return room.token ?? null;
}

// ============================================================================
// Live field editor — atomic single-field updates
// ============================================================================

export type UpdateWorkshopFieldResult =
  | { ok: true }
  | { ok: false; error: string };

interface FieldUpdate {
  col: string;
  // Re-using the registry's own union rather than restating it: this list had
  // already drifted (it still named artist_profiles after the facilitator
  // fields moved to users + org_profiles), and a local copy can only drift
  // again.
  table: FieldTable;
  value: unknown;
}

/**
 * Bridge action consumed by WorkshopLiveEditor.
 * Accepts the generic SaveFieldPayload from @elkdonis/live-editor, looks up
 * the field registry to resolve table/column, and delegates to
 * updateWorkshopFieldAction.
 */
export async function updateWorkshopFieldByTraitAction(
  threadId: string,
  payload: { trait: string; value: string | Record<string, string> }
): Promise<UpdateWorkshopFieldResult> {
  const { fieldRegistry } = await import("@elkdonis/cms-bindings");

  const meta = fieldRegistry[payload.trait];
  if (!meta || meta.input === "readonly") {
    return { ok: false, error: `Field '${payload.trait}' is not editable` };
  }

  const numericCols = new Set([
    "price", "attendee_limit", "session_count", "session_duration_hrs",
    "price_sliding_min", "price_member", "duration_minutes",
  ]);

  function coerce(col: string, raw: string): unknown {
    if (numericCols.has(col)) return raw === "" ? null : Number(raw);
    return raw === "" ? null : raw;
  }

  let updates: FieldUpdate[];

  if (meta.input === "compound" && meta.compound) {
    const vals = payload.value as Record<string, string>;
    updates = meta.compound.map((f) => ({
      col: f.col,
      table: f.table,
      value: coerce(f.col, vals[f.col] ?? ""),
    }));
  } else {
    updates = [{
      col: meta.col,
      table: meta.table,
      value: coerce(meta.col, payload.value as string),
    }];
  }

  return updateWorkshopFieldAction(threadId, updates);
}

/**
 * Atomically update one or more fields on a workshop and its related tables.
 * Called by the live editor (FieldPopover) on save.
 * Each update targets exactly one col in one table — no partial upsert of the
 * full sidecar row.
 */
export async function updateWorkshopFieldAction(
  threadId: string,
  updates: FieldUpdate[]
): Promise<UpdateWorkshopFieldResult> {
  if (!updates.length) return { ok: true };

  const user = await requireUser();

  const rows = await db<
    { org_id: string; org_slug: string; author_id: string }[]
  >`
    SELECT t.org_id, o.slug AS org_slug, t.author_id
    FROM threads t
    JOIN organizations o ON o.id = t.org_id
    WHERE t.id = ${threadId} AND t.kind = 'workshop'
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Thread not found" };

  const allowed = await canEditOrgSite(user.id, row.org_id);
  if (!allowed) return { ok: false, error: "Not authorized" };

  const threadCols: Record<string, unknown> = {};
  const wpCols: Record<string, unknown> = {};
  const userCols: Record<string, unknown> = {};
  const orgProfileCols: Record<string, unknown> = {};

  for (const u of updates) {
    if (u.table === "threads") threadCols[u.col] = u.value;
    else if (u.table === "workshop_pages") wpCols[u.col] = u.value;
    else if (u.table === "users") userCols[u.col] = u.value;
    else if (u.table === "org_profiles") orgProfileCols[u.col] = u.value;
  }

  if (Object.keys(threadCols).length > 0) {
    await db`
      UPDATE threads SET ${db(threadCols)}, updated_at = NOW()
      WHERE id = ${threadId}
    `;
  }

  if (Object.keys(wpCols).length > 0) {
    // Ensure the sidecar row exists, then update only the requested columns.
    await db`
      INSERT INTO workshop_pages (thread_id) VALUES (${threadId})
      ON CONFLICT (thread_id) DO NOTHING
    `;
    await db`
      UPDATE workshop_pages SET ${db(wpCols)} WHERE thread_id = ${threadId}
    `;
  }

  // Facilitator identity. Scoped to the workshop's AUTHOR by primary key.
  //
  // This replaces `UPDATE artist_profiles SET … WHERE org_id = (SELECT org_id
  // FROM threads WHERE id = …)` — no user filter and no LIMIT, so editing one
  // facilitator's name inline rewrote every member's personal profile row in
  // that org. `elkdonis` holds 10 such rows; it had not fired only because
  // that org has no workshops yet.
  if (Object.keys(userCols).length > 0) {
    await db`
      UPDATE users SET ${db(userCols)}, updated_at = NOW()
      WHERE id = ${row.author_id}
    `;
  }

  // Role title is per-org, so it lives on the author's org_profiles row.
  // Ensure the row exists first: a facilitator can author a workshop for an org
  // they hold a membership in without having been published on its roster.
  if (Object.keys(orgProfileCols).length > 0) {
    await db`
      INSERT INTO org_profiles (org_id, user_id) VALUES (${row.org_id}, ${row.author_id})
      ON CONFLICT (org_id, user_id) DO NOTHING
    `;
    await db`
      UPDATE org_profiles SET ${db(orgProfileCols)}
      WHERE org_id = ${row.org_id} AND user_id = ${row.author_id}
    `;
  }

  // The workshop page uses force-dynamic so the next visit always re-fetches.
  // Revalidate the org landing page in case feeds show updated data.
  revalidatePath(`/sites/${row.org_slug}`);
  return { ok: true };
}

// ============================================================================
// Live CSS theme editor — persist theme_overrides JSONB
// ============================================================================

export type UpdateWorkshopThemeResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Persist CSS custom property overrides for a workshop page.
 * Merges new values into the existing theme_overrides JSONB object.
 * Called by the CssPanel on save.
 */
export async function updateWorkshopThemeAction(
  threadId: string,
  overrides: Record<string, string>
): Promise<UpdateWorkshopThemeResult> {
  const user = await requireUser();

  const rows = await db<{ org_id: string; org_slug: string }[]>`
    SELECT t.org_id, o.slug AS org_slug
    FROM threads t
    JOIN organizations o ON o.id = t.org_id
    WHERE t.id = ${threadId} AND t.kind = 'workshop'
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Thread not found" };

  const allowed = await canEditOrgSite(user.id, row.org_id);
  if (!allowed) return { ok: false, error: "Not authorized" };

  await db`
    INSERT INTO workshop_pages (thread_id, theme_overrides)
    VALUES (${threadId}, ${db.json(overrides)})
    ON CONFLICT (thread_id) DO UPDATE
    SET theme_overrides = workshop_pages.theme_overrides || ${db.json(overrides)}
  `;

  revalidatePath(`/sites/${row.org_slug}`);
  return { ok: true };
}

// ============================================================================
// Workshop pages sidecar
// ============================================================================

export type UpsertWorkshopPageResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Create or update the workshop_pages sidecar row for a workshop thread.
 * The user must have edit rights on the org that owns the thread.
 */
export async function upsertWorkshopPageAction(
  input: WorkshopPageInput
): Promise<UpsertWorkshopPageResult> {
  const parsed = workshopPageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  const user = await requireUser();

  const threadRows = await db<{ org_id: string; kind: string; org_slug: string }[]>`
    SELECT t.org_id, t.kind, o.slug AS org_slug
    FROM threads t
    JOIN organizations o ON o.id = t.org_id
    WHERE t.id = ${data.thread_id}
    LIMIT 1
  `;
  const thread = threadRows[0];
  if (!thread) return { ok: false, error: "Thread not found" };
  if (thread.kind !== "workshop") return { ok: false, error: "Thread is not a workshop" };

  const allowed = await canEditOrgSite(user.id, thread.org_id);
  if (!allowed) return { ok: false, error: "Not authorized" };

  const regDeadline = data.registration_deadline
    ? new Date(data.registration_deadline)
    : null;

  await db`
    INSERT INTO workshop_pages (
      thread_id,
      subtitle, description_short, discipline, series_label,
      level, language, session_count, session_duration_hrs,
      recurrence_label, location_address, accessibility_notes,
      price_sliding_min, price_member, sliding_scale_note,
      registration_url, registration_deadline, registration_status,
      author_note,
      cover_image_url, promo_video_url, gallery_image_urls,
      banner_image_url, banner_focal_y,
      hero_media_url, hero_media_type, hero_text, background_color,
      seo_title, seo_description, og_image_url,
      optional_sections
    ) VALUES (
      ${data.thread_id},
      ${data.subtitle || null}, ${data.description_short || null},
      ${data.discipline || null}, ${data.series_label || null},
      ${data.level ?? null}, ${data.language},
      ${data.session_count ?? null}, ${data.session_duration_hrs ?? null},
      ${data.recurrence_label || null}, ${data.location_address || null},
      ${data.accessibility_notes || null},
      ${data.price_sliding_min ?? null}, ${data.price_member ?? null},
      ${data.sliding_scale_note || null},
      ${data.registration_url || null}, ${regDeadline},
      ${data.registration_status},
      ${data.author_note || null},
      ${data.cover_image_url || null}, ${data.promo_video_url || null},
      ${db.json(data.gallery_image_urls ?? [])},
      ${data.banner_image_url || null}, ${data.banner_focal_y ?? null},
      ${data.hero_media_url || null},
      ${data.hero_media_url ? (data.hero_media_type || "image") : null},
      ${data.hero_text || null}, ${data.background_color || null},
      ${data.seo_title || null}, ${data.seo_description || null},
      ${data.og_image_url || null},
      ${db.json(data.optional_sections)}
    )
    ON CONFLICT (thread_id) DO UPDATE SET
      subtitle             = EXCLUDED.subtitle,
      description_short    = EXCLUDED.description_short,
      discipline           = EXCLUDED.discipline,
      series_label         = EXCLUDED.series_label,
      level                = EXCLUDED.level,
      language             = EXCLUDED.language,
      session_count        = EXCLUDED.session_count,
      session_duration_hrs = EXCLUDED.session_duration_hrs,
      recurrence_label     = EXCLUDED.recurrence_label,
      location_address     = EXCLUDED.location_address,
      accessibility_notes  = EXCLUDED.accessibility_notes,
      price_sliding_min    = EXCLUDED.price_sliding_min,
      price_member         = EXCLUDED.price_member,
      sliding_scale_note   = EXCLUDED.sliding_scale_note,
      registration_url     = EXCLUDED.registration_url,
      registration_deadline = EXCLUDED.registration_deadline,
      registration_status  = EXCLUDED.registration_status,
      author_note          = EXCLUDED.author_note,
      cover_image_url      = EXCLUDED.cover_image_url,
      promo_video_url      = EXCLUDED.promo_video_url,
      gallery_image_urls   = EXCLUDED.gallery_image_urls,
      banner_image_url     = EXCLUDED.banner_image_url,
      banner_focal_y       = EXCLUDED.banner_focal_y,
      hero_media_url       = EXCLUDED.hero_media_url,
      hero_media_type      = EXCLUDED.hero_media_type,
      hero_text            = EXCLUDED.hero_text,
      background_color     = EXCLUDED.background_color,
      seo_title            = EXCLUDED.seo_title,
      seo_description      = EXCLUDED.seo_description,
      og_image_url         = EXCLUDED.og_image_url,
      optional_sections    = EXCLUDED.optional_sections
  `;

  revalidatePath(`/hub`);
  revalidatePath(`/sites/${thread.org_slug}`);
  return { ok: true };
}

// ============================================================================
// Unified workshop save (thread + sidecar in one action)
// ============================================================================

/** Fields that trigger an attendee-change warning when edited. */
const ATTENDEE_SENSITIVE_FIELDS = [
  "scheduled_at",
  "location",
  "location_address",
  "format",
  "registration_status",
] as const;

export type SaveWorkshopResult =
  | {
      ok: true;
      thread_id: string;
      slug: string;
      /** Non-empty when attendee-affecting fields changed on an existing thread. */
      attendeeChangeWarning?: string[];
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Create or update a workshop — thread row + workshop_pages sidecar — in one
 * action. On create, both rows are written atomically. On update, a diff of
 * attendee-sensitive fields is returned so the UI can prompt the owner to
 * notify enrolled attendees.
 *
 * Package extraction note: the pure business logic here (diff detection,
 * sidecar upsert SQL) belongs in packages/cms-bindings once that package
 * exists. The auth + revalidate wrappers stay in the app.
 */
export async function saveWorkshopAction(
  input: WorkshopFullInput
): Promise<SaveWorkshopResult> {
  const parsed = workshopFullSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  const user = await requireUser();

  const orgs = await db<{ id: string; slug: string; name: string }[]>`
    SELECT id, slug, name FROM organizations WHERE slug = ${data.orgSlug} LIMIT 1
  `;
  const org = orgs[0];
  if (!org) return { ok: false, error: "Organization not found" };

  const allowed = await canEditOrgSite(user.id, org.id);
  if (!allowed) return { ok: false, error: "Not authorized" };

  // ── What is about to change, for the people already signed up ────────────
  //
  // Read before the write, because afterwards there is nothing to compare
  // against. This is the one part of saving a workshop that is genuinely this
  // app's own: the shared service stores the workshop, and the warning is
  // about how this app's editor behaves once it has.
  const attendeeChangeWarning: string[] = [];
  if (data.thread_id) {
    const [prev] = await db<
      {
        org_id: string;
        scheduled_at: Date | null;
        location: string | null;
        format: string | null;
        registration_status: string | null;
      }[]
    >`
      SELECT t.org_id, t.scheduled_at, t.location, t.format, wp.registration_status
      FROM threads t
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.id = ${data.thread_id} AND t.kind = 'workshop'
      LIMIT 1
    `;
    if (!prev) return { ok: false, error: "Thread not found" };
    if (prev.org_id !== org.id) return { ok: false, error: "Not authorized" };

    const nextScheduled = data.scheduled_at ? new Date(data.scheduled_at).toISOString() : null;
    if ((prev.scheduled_at?.toISOString() ?? null) !== nextScheduled) {
      attendeeChangeWarning.push("scheduled_at");
    }
    if ((prev.location ?? "") !== (data.location ?? "")) attendeeChangeWarning.push("location");
    if ((prev.format ?? "") !== (data.format ?? "")) attendeeChangeWarning.push("format");
    if ((prev.registration_status ?? "open") !== data.registration_status) {
      attendeeChangeWarning.push("registration_status");
    }
  }

  // ── The write ────────────────────────────────────────────────────────────
  //
  // This was ~170 lines of INSERT/UPDATE against threads and workshop_pages,
  // beside an identical pair in @elkdonis/services that innergathering and
  // the compose surfaces already used. Two write paths into the same two
  // tables meant every column added had to be added twice, and one of them
  // was always behind — sessions were the proof: this action wrote them to
  // the vestigial `threads.sessions` JSON column while the public workshop
  // page read `workshop_sessions`, so a session authored here never appeared
  // there. The service writes the rows the page reads.
  let saved: { id: string; slug: string };
  try {
    saved = await upsertWorkshopOffering(
      org.id,
      user.id,
      {
        title: data.title,
        body: data.body || null,
        excerpt: data.description_short || deriveExcerpt(data.body ?? null) || null,
        status: data.status,
        visibility: data.visibility,
        shareToNetwork: data.share_to_network,
        // Workshops here are addressed by their own route, not by a feed.
        section: null,
        // A retitled workshop keeps the URL it was published at.
        keepSlug: true,

        format: data.format,
        scheduledAt: data.scheduled_at || null,
        durationMinutes: data.duration_minutes ?? null,
        location: data.location || null,
        locationAddress: data.location_address || null,
        meetingUrl: data.meeting_url || null,
        nextcloudDocUrl: data.nextcloud_doc_url || null,
        isRsvpEnabled: data.is_rsvp_enabled,
        attendeeLimit: data.attendee_limit ?? null,

        price: data.price ?? null,
        currency: data.currency,
        priceMember: data.price_member ?? null,
        priceSlidingMin: data.price_sliding_min ?? null,
        slidingScaleNote: data.sliding_scale_note || null,

        registrationStatus: data.registration_status,
        registrationUrl: data.registration_url || null,
        registrationDeadline: data.registration_deadline || null,

        subtitle: data.subtitle || null,
        descriptionShort: data.description_short || null,
        discipline: data.discipline || null,
        seriesLabel: data.series_label || null,
        level: data.level ?? null,
        language: data.language,
        sessionCount: data.session_count ?? null,
        sessionDurationHrs: data.session_duration_hrs ?? null,
        recurrenceLabel: data.recurrence_label || null,
        accessibilityNotes: data.accessibility_notes || null,
        authorNote: data.author_note || null,

        coverImageUrl: data.cover_image_url || null,
        bannerImageUrl: data.banner_image_url || null,
        bannerFocalY: data.banner_focal_y ?? null,
        heroMediaUrl: data.hero_media_url || null,
        heroMediaType: data.hero_media_type ?? null,
        heroText: data.hero_text || null,
        backgroundColor: data.background_color || null,
        // The schema makes every gallery field optional-ish; a tile with no
        // address is not a tile, so it is dropped rather than stored empty.
        galleryImageUrls: (data.gallery_image_urls ?? [])
          .filter((g): g is { url: string; alt?: string; caption?: string } => Boolean(g?.url))
          .map((g) => ({ url: g.url, alt: g.alt, caption: g.caption })),
        promoVideoUrl: data.promo_video_url || null,

        seoTitle: data.seo_title || null,
        seoDescription: data.seo_description || null,
        ogImageUrl: data.og_image_url || null,
        optionalSections: data.optional_sections,

        sessions: data.sessions.map((session, i) => ({
          title: session.title || `Session ${i + 1}`,
          scheduledAt: session.scheduled_at || null,
          durationMinutes: session.duration_minutes ?? null,
          location: session.location || "",
          // This app's session form has no online/in-person switch of its
          // own; a session inherits the workshop's format.
          isOnline: data.format !== "in_person",
          videoConferenceUrl: session.meeting_url || "",
        })),
      },
      data.thread_id || undefined
    );
  } catch (err) {
    console.error("[arts-collective] saveWorkshopAction:", err);
    return {
      ok: false,
      error: err instanceof Error && err.message === "Workshop not found"
        ? "Thread not found"
        : "Could not save the workshop.",
    };
  }

  // The materials folder exists from the first save, with whoever saved
  // holding it read/write — same as innergathering.
  void ensureWorkshopMaterialsFolder(org.id, saved.id);

  revalidatePath(`/hub/workshops/${org.slug}`);
  revalidatePath(`/hub/workshops/${org.slug}/${saved.id}`);
  revalidatePath(`/sites/${org.slug}/workshop/${saved.slug}`);
  revalidatePath(`/sites/${org.slug}/${saved.slug}`);
  revalidatePath(`/sites/${org.slug}`);

  return {
    ok: true,
    thread_id: saved.id,
    slug: saved.slug,
    ...(attendeeChangeWarning.length > 0 && { attendeeChangeWarning }),
  };
}
