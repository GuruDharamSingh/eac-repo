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
 * workshop_pages sidecar — template-filling fields.
 * Validated separately from the thread row and saved to workshop_pages.
 */
export const workshopPageSchema = z.object({
  thread_id: z.string().min(1),

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
  registration_deadline: z.string().optional().or(z.literal("")), // date string YYYY-MM-DD
  registration_status: z.enum(["open", "waitlist", "full", "closed"]).default("open"),

  // Author override
  author_note: z.string().trim().optional().or(z.literal("")),

  // Media
  cover_image_url: z.string().trim().url().optional().or(z.literal("")),
  promo_video_url: z.string().trim().url().optional().or(z.literal("")),

  // SEO
  seo_title: z.string().trim().max(70).optional().or(z.literal("")),
  seo_description: z.string().trim().max(160).optional().or(z.literal("")),
  og_image_url: z.string().trim().url().optional().or(z.literal("")),

  // Template editor
  optional_sections: z.record(z.string(), z.boolean()).default({}),
});

export type WorkshopPageInput = z.infer<typeof workshopPageSchema>;

export const threadFormSchema = z.discriminatedUnion("kind", [
  postFormSchema,
  workshopFormSchema,
  eventFormSchema,
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

  // Sidecar — identity
  subtitle: z.string().trim().max(200).optional().or(z.literal("")),
  description_short: z.string().trim().max(500).optional().or(z.literal("")),
  discipline: z.string().trim().max(80).optional().or(z.literal("")),
  series_label: z.string().trim().max(80).optional().or(z.literal("")),

  // Sidecar — logistics
  level: z.enum(["all_levels", "beginner", "intermediate", "advanced"]).optional(),
  language: z.string().trim().max(60).default("English"),
  session_count: optNum(z.number().int().min(1).max(999)),
  session_duration_hrs: optNum(z.number().min(0.25).max(24)),
  recurrence_label: z.string().trim().max(200).optional().or(z.literal("")),
  location_address: z.string().trim().max(500).optional().or(z.literal("")),
  accessibility_notes: z.string().trim().optional().or(z.literal("")),

  // Sidecar — pricing
  price_sliding_min: optNum(z.number().min(0).max(99999)),
  price_member: optNum(z.number().min(0).max(99999)),
  sliding_scale_note: z.string().trim().max(300).optional().or(z.literal("")),

  // Sidecar — registration
  registration_url: z.string().trim().url().optional().or(z.literal("")),
  registration_deadline: z.string().optional().or(z.literal("")),
  registration_status: z.enum(["open", "waitlist", "full", "closed"]).default("open"),

  // Sidecar — author
  author_note: z.string().trim().optional().or(z.literal("")),

  // Sidecar — media
  cover_image_url: z.string().trim().url().optional().or(z.literal("")),
  promo_video_url: z.string().trim().url().optional().or(z.literal("")),

  // Sidecar — SEO
  seo_title: z.string().trim().max(70).optional().or(z.literal("")),
  seo_description: z.string().trim().max(160).optional().or(z.literal("")),
  og_image_url: z.string().trim().url().optional().or(z.literal("")),

  // Sidecar — template editor
  optional_sections: z.record(z.string(), z.boolean()).default({}),
});

export type WorkshopFullInput = z.infer<typeof workshopFullSchema>;

export type ThreadFormInput = z.infer<typeof threadFormSchema>;
export type PostFormInput = z.infer<typeof postFormSchema>;
export type WorkshopFormInput = z.infer<typeof workshopFormSchema>;
export type EventFormInput = z.infer<typeof eventFormSchema>;

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
