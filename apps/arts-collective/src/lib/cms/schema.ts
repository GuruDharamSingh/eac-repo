import { z } from "zod";

/**
 * Form schemas for the Arts Collective CMS.
 *
 * Three thread kinds today: post, workshop, event.
 * `meeting` is the legacy kind name and is not surfaced in the form.
 */

// HTML number inputs submit "" when empty. Zod's coerce turns "" into 0, which
// then fails min(1) / min(0.25) constraints, silently blocking form submission.
// This helper normalises empty/null → undefined before the numeric check runs.
function optNum(schema: z.ZodNumber) {
  return z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : typeof v === "number" ? v : Number(v)),
    schema.optional()
  );
}

export const sessionSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().max(200).optional().or(z.literal("")),
  scheduled_at: z.string().min(1, "Pick a start time"),
  duration_minutes: optNum(z.number().int().min(5).max(60 * 24)),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  meeting_url: z.string().trim().url().optional().or(z.literal("")),
});

export type SessionInput = z.infer<typeof sessionSchema>;

const baseFields = {
  orgSlug: z.string().min(1),
  title: z.string().trim().min(2, "Give it a title").max(200),
  excerpt: z.string().trim().max(280).optional().or(z.literal("")),
  /** HTML produced by the Tiptap rich-text editor. */
  body: z.string().optional().or(z.literal("")),
  status: z.enum(["draft", "published"]).default("draft"),
  visibility: z
    .enum(["PUBLIC", "ORGANIZATION", "INVITE_ONLY"])
    .default("PUBLIC"),
  share_to_network: z.boolean().default(false),
  /** Optional Nextcloud Talk room creation flag (workshop/event only). */
  create_talk_room: z.boolean().default(false),
  /** Optional Nextcloud collaborative document URL/link. */
  nextcloud_doc_url: z.string().trim().url().optional().or(z.literal("")),
  /**
   * Cover image, chosen through the compose sheet's media pane.
   *
   * Rides in `threads.metadata` — there is no `cover_image_url` column, and
   * amrit-canada already established that convention rather than adding one.
   * A relative platform URL (`/api/media/...`), so `.url()` would reject it.
   */
  cover_image_url: z.string().trim().max(500).optional().or(z.literal("")),
};

export const postFormSchema = z.object({
  kind: z.literal("post"),
  ...baseFields,
});

export const workshopFormSchema = z.object({
  kind: z.literal("workshop"),
  ...baseFields,
  scheduled_at: z.string().min(1, "Pick a start time"),
  duration_minutes: optNum(z.number().int().min(5).max(60 * 24)),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  /** Replaces the deprecated is_online boolean. */
  format: z.enum(["in_person", "online", "hybrid"]).default("online"),
  meeting_url: z.string().trim().url().optional().or(z.literal("")),
  is_rsvp_enabled: z.boolean().default(true),
  attendee_limit: optNum(z.number().int().min(1).max(10000)),
  price: optNum(z.number().min(0).max(99999)),
  currency: z.string().trim().length(3).default("USD"),
  sessions: z.array(sessionSchema).default([]),
});

export const eventFormSchema = z.object({
  kind: z.literal("event"),
  ...baseFields,
  scheduled_at: z.string().min(1, "Pick a start time"),
  duration_minutes: optNum(z.number().int().min(5).max(60 * 24)),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  /** Replaces the deprecated is_online boolean. */
  format: z.enum(["in_person", "online", "hybrid"]).default("online"),
  meeting_url: z.string().trim().url().optional().or(z.literal("")),
  is_rsvp_enabled: z.boolean().default(true),
  attendee_limit: optNum(z.number().int().min(1).max(10000)),
});

/**
 * Every `workshop_pages` sidecar column, declared once.
 *
 * `workshopPageSchema` (sidecar-only) and `workshopFullSchema` (thread +
 * sidecar) both spread this. They used to restate the whole list independently,
 * which is how six columns — the banner/hero/theme group plus
 * `gallery_image_urls` — ended up writable by inner-gathering and by the field
 * registry but not by this app's save path. See scripts/check-workshop-fields.mjs.
 */
export const workshopSidecarFields = {
  // Identity
  subtitle: z.string().trim().max(200).optional().or(z.literal("")),
  description_short: z.string().trim().max(500).optional().or(z.literal("")),
  discipline: z.string().trim().max(80).optional().or(z.literal("")),
  series_label: z.string().trim().max(80).optional().or(z.literal("")),

  // Logistics
  level: z.enum(["all_levels", "beginner", "intermediate", "advanced"]).optional(),
  language: z.string().trim().max(60).default("English"),
  session_count: optNum(z.number().int().min(1).max(999)),
  session_duration_hrs: optNum(z.number().min(0.25).max(24)),
  recurrence_label: z.string().trim().max(200).optional().or(z.literal("")),
  location_address: z.string().trim().max(500).optional().or(z.literal("")),
  accessibility_notes: z.string().trim().optional().or(z.literal("")),

  // Pricing
  price_sliding_min: optNum(z.number().min(0).max(99999)),
  price_member: optNum(z.number().min(0).max(99999)),
  sliding_scale_note: z.string().trim().max(300).optional().or(z.literal("")),

  // Registration
  registration_url: z.string().trim().url().optional().or(z.literal("")),
  registration_deadline: z.string().optional().or(z.literal("")), // YYYY-MM-DD
  registration_status: z.enum(["open", "waitlist", "full", "closed"]).default("open"),

  // Author override
  author_note: z.string().trim().optional().or(z.literal("")),

  // Media
  cover_image_url: z.string().trim().url().optional().or(z.literal("")),
  promo_video_url: z.string().trim().url().optional().or(z.literal("")),
  /** Tiles for the template's `galleryImages` list binding. */
  gallery_image_urls: z
    .array(
      z.object({
        url: z.string().trim().min(1),
        alt: z.string().trim().max(300).optional(),
        caption: z.string().trim().max(300).optional(),
      })
    )
    .default([]),

  // Banner / hero / theme — written by inner-gathering's POST /api/workshops
  banner_image_url: z.string().trim().url().optional().or(z.literal("")),
  banner_focal_y: optNum(z.number().min(0).max(100)),
  hero_media_url: z.string().trim().url().optional().or(z.literal("")),
  hero_media_type: z.enum(["image", "video"]).optional(),
  hero_text: z.string().trim().max(2000).optional().or(z.literal("")),
  background_color: z.string().trim().max(32).optional().or(z.literal("")),

  // SEO
  seo_title: z.string().trim().max(70).optional().or(z.literal("")),
  seo_description: z.string().trim().max(160).optional().or(z.literal("")),
  og_image_url: z.string().trim().url().optional().or(z.literal("")),

  // Template editor
  optional_sections: z.record(z.string(), z.boolean()).default({}),
} as const;

export const workshopPageSchema = z.object({
  thread_id: z.string().min(1),
  ...workshopSidecarFields,
});

export type WorkshopPageInput = z.infer<typeof workshopPageSchema>;

/**
 * Same shape as an event, because it IS one.
 *
 * This app called it "event" and inner-gathering and amrit-canada called it
 * "meeting"; the database has 16 `meeting` rows and **zero** `event` rows, so
 * the name this app used was the one nobody wrote. Both are accepted rather
 * than renaming under live data, and the hub's "Community Meeting" card now
 * writes `meeting` so it lands in the same bucket as the rest of the network's
 * gatherings instead of a kind of its own.
 */
export const meetingFormSchema = eventFormSchema.extend({
  kind: z.literal("meeting"),
});

export const threadFormSchema = z.discriminatedUnion("kind", [
  postFormSchema,
  workshopFormSchema,
  eventFormSchema,
  meetingFormSchema,
]);

// ─── Unified workshop form (thread + sidecar in one submit) ──────────────────

export const workshopFullSchema = z.object({
  // Routing
  orgSlug: z.string().min(1),
  thread_id: z.string().optional(), // absent on create

  // Thread — core
  title: z.string().trim().min(2, "Give it a title").max(200),
  body: z.string().optional().or(z.literal("")),
  status: z.enum(["draft", "published"]).default("draft"),
  visibility: z.enum(["PUBLIC", "ORGANIZATION", "INVITE_ONLY"]).default("PUBLIC"),
  share_to_network: z.boolean().default(false),

  // Thread — schedule & logistics
  scheduled_at: z.string().optional().or(z.literal("")),
  duration_minutes: optNum(z.number().int().min(5).max(60 * 24)),
  format: z.enum(["in_person", "online", "hybrid"]).default("online"),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  meeting_url: z.string().trim().url().optional().or(z.literal("")),
  is_rsvp_enabled: z.boolean().default(true),
  attendee_limit: optNum(z.number().int().min(1).max(10000)),
  price: optNum(z.number().min(0).max(99999)),
  currency: z.string().trim().length(3).default("USD"),
  sessions: z.array(sessionSchema).default([]),
  nextcloud_doc_url: z.string().trim().url().optional().or(z.literal("")),

  ...workshopSidecarFields,
});

export type WorkshopFullInput = z.infer<typeof workshopFullSchema>;

export type ThreadFormInput = z.infer<typeof threadFormSchema>;
export type PostFormInput = z.infer<typeof postFormSchema>;
export type WorkshopFormInput = z.infer<typeof workshopFormSchema>;
export type EventFormInput = z.infer<typeof eventFormSchema>;
export type MeetingFormInput = z.infer<typeof meetingFormSchema>;

/**
 * Build a slug candidate from a title. Server appends a short suffix on
 * collision rather than failing.
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}
