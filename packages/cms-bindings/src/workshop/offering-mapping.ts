/**
 * Wizard answers → `WorkshopOfferingInput`.
 *
 * The wizard collects values keyed by trait; `upsertWorkshopOffering` in
 * @elkdonis/services takes a camelCase input object. This is the one place
 * that translation happens, so the wizard does not become a fourth write path
 * alongside `saveWorkshopAction` and `updateWorkshopFieldAction`.
 *
 * The mapping is a single explicit table rather than an `inputKey` scattered
 * across forty-eight registry entries: it keeps the registry about authoring,
 * and it makes the inverse question — which columns the shared write path
 * *cannot* set — answerable by reading one list (`unmappedColumns()`).
 *
 * No import from @elkdonis/services: that package is built and this one is
 * source-exported, and the dependency would only buy a type. The caller casts.
 */
import { fieldRegistry, type FieldMeta } from "./field-registry";
import { columnKey, lookupTrait, type ColumnKey } from "./field-index";

/**
 * `table.column` → the `WorkshopOfferingInput` property that writes it.
 *
 * Columns absent from this table cannot be written through the shared path.
 * `artist_profiles.*` is deliberately absent — those are profile fields with
 * their own write path, and they still target the table migration 084
 * superseded (see the facilitator step).
 */
export const COLUMN_TO_INPUT_KEY: Record<ColumnKey, string> = {
  "threads.title": "title",
  "threads.body": "body",
  "threads.location": "location",
  "threads.format": "format",
  "threads.price": "price",
  "threads.currency": "currency",
  "threads.scheduled_at": "scheduledAt",
  "threads.duration_minutes": "durationMinutes",
  "threads.attendee_limit": "attendeeLimit",
  "threads.rsvp_deadline": "rsvpDeadline",
  "threads.min_attendees": "minAttendees",
  "threads.reminder_minutes_before": "reminderMinutesBefore",

  "workshop_pages.subtitle": "subtitle",
  "workshop_pages.description_short": "descriptionShort",
  "workshop_pages.discipline": "discipline",
  "workshop_pages.series_label": "seriesLabel",
  "workshop_pages.level": "level",
  "workshop_pages.language": "language",
  "workshop_pages.session_count": "sessionCount",
  "workshop_pages.session_duration_hrs": "sessionDurationHrs",
  "workshop_pages.recurrence_label": "recurrenceLabel",
  "workshop_pages.location_address": "locationAddress",
  "workshop_pages.accessibility_notes": "accessibilityNotes",
  "workshop_pages.author_note": "authorNote",
  "workshop_pages.price_sliding_min": "priceSlidingMin",
  "workshop_pages.price_member": "priceMember",
  "workshop_pages.sliding_scale_note": "slidingScaleNote",
  "workshop_pages.registration_url": "registrationUrl",
  "workshop_pages.registration_deadline": "registrationDeadline",
  "workshop_pages.registration_status": "registrationStatus",
  "workshop_pages.cover_image_url": "coverImageUrl",
  "workshop_pages.banner_image_url": "bannerImageUrl",
  "workshop_pages.banner_focal_y": "bannerFocalY",
  "workshop_pages.hero_media_url": "heroMediaUrl",
  "workshop_pages.hero_media_type": "heroMediaType",
  "workshop_pages.hero_text": "heroText",
  "workshop_pages.background_color": "backgroundColor",
  "workshop_pages.gallery_image_urls": "galleryImageUrls",
  "workshop_pages.promo_video_url": "promoVideoUrl",
  "workshop_pages.seo_title": "seoTitle",
  "workshop_pages.seo_description": "seoDescription",
  "workshop_pages.og_image_url": "ogImageUrl",
};

/**
 * Registry columns with no route through `upsertWorkshopOffering`.
 * A field appearing here is one the wizard can display but not save.
 */
export function unmappedColumns(): ColumnKey[] {
  const out = new Set<ColumnKey>();
  for (const meta of Object.values(fieldRegistry)) {
    if (meta.input === "readonly") continue;
    const keys = [columnKey(meta.table, meta.col)];
    for (const c of meta.compound ?? []) keys.push(columnKey(c.table, c.col));
    for (const key of keys) {
      if (!(key in COLUMN_TO_INPUT_KEY)) out.add(key);
    }
  }
  return [...out].sort();
}

/**
 * Coerce a form value for its column, using the registry's declared input type
 * rather than a hardcoded list of numeric columns (which is how the live
 * editor's save path does it, and which silently rots as fields are added).
 */
export function coerceValue(input: FieldMeta["input"], raw: unknown): unknown {
  if (raw === "" || raw === undefined) return null;

  switch (input) {
    case "number":
      return raw === null ? null : Number(raw);
    case "boolean":
      return typeof raw === "boolean" ? raw : raw === "true";
    case "gallery":
      // Already structured — never stringify, the column is jsonb.
      return Array.isArray(raw) ? raw : [];
    default:
      return raw;
  }
}

export interface MappedOffering {
  /** Ready to spread into a `WorkshopOfferingInput`. */
  input: Record<string, unknown>;
  /**
   * Traits whose columns have no input key — `artist_profiles.*` fields, which
   * the caller must persist through the profile write path instead. Silently
   * dropping these is how a facilitator's name appears to save and does not.
   */
  unmapped: Array<{ trait: string; table: string; col: string; value: unknown }>;
}

/**
 * @param answers Trait-keyed values. A compound trait's value is a
 *   `Record<column, value>`, matching the live editor's `SaveFieldPayload`.
 */
export function answersToOfferingInput(
  answers: Record<string, unknown>
): MappedOffering {
  const input: Record<string, unknown> = {};
  const unmapped: MappedOffering["unmapped"] = [];

  const assign = (table: string, col: string, value: unknown, trait: string, meta: FieldMeta) => {
    const key = COLUMN_TO_INPUT_KEY[columnKey(table, col)];
    if (!key) {
      unmapped.push({ trait, table, col, value });
      return;
    }
    input[key] = coerceValue(meta.input, value);
  };

  for (const [trait, value] of Object.entries(answers)) {
    const meta = lookupTrait(trait);
    if (!meta || meta.input === "readonly") continue;

    if (meta.input === "compound" && meta.compound) {
      const parts = (value ?? {}) as Record<string, unknown>;
      for (const c of meta.compound) {
        if (!(c.col in parts)) continue;
        // A compound member declares its own input type; use it, not the
        // wrapper's "compound".
        assign(c.table, c.col, parts[c.col], trait, { ...meta, input: c.input });
      }
      continue;
    }

    assign(meta.table, meta.col, value, trait, meta);
  }

  return { input, unmapped };
}
