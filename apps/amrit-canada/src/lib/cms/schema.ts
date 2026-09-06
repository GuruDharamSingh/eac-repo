import { z } from "zod";

/**
 * Content form schemas.
 *
 * Adapted from apps/arts-collective/src/lib/cms/schema.ts — the same
 * discriminated-union-on-kind shape — with one addition that matters here:
 * every piece of content must name the FEED it publishes to. That's the
 * "which of my three pages does this go on" control, and it's the field
 * arts-collective's version doesn't have.
 *
 * Kinds this pass: post and meeting. Workshops (sessions, materials, pricing)
 * are deliberately out of scope; the union is left open for that addition.
 */

// HTML number inputs submit "" when empty. z.coerce turns "" into 0, which
// then fails min() and silently blocks submission — normalise to undefined
// before the numeric check runs.
function optNum(schema: z.ZodNumber) {
  return z.preprocess(
    (v) =>
      v === "" || v === null || v === undefined
        ? undefined
        : typeof v === "number"
          ? v
          : Number(v),
    schema.optional()
  );
}

const baseFields = {
  /** org_feeds.slug — which page this appears on. */
  feedSlug: z.string().min(1, "Choose which page this goes on"),
  title: z.string().trim().min(2, "Give it a title").max(200),
  excerpt: z.string().trim().max(280).optional().or(z.literal("")),
  /** HTML from the Tiptap editor. */
  body: z.string().optional().or(z.literal("")),
  // Produced by the media picker (an /api/media/... path), or empty. Not a
  // full URL, so no .url() here.
  coverImageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  /** media.id values to attach as downloadable materials. */
  materialIds: z.array(z.string()).default([]),
  /** Provision a Nextcloud collaborative document for this item. */
  createDocument: z.boolean().default(false),
  /** Provision a Nextcloud Talk room (public, so guests can join). */
  createTalkRoom: z.boolean().default(false),
  status: z.enum(["draft", "published"]).default("draft"),
  visibility: z.enum(["PUBLIC", "ORGANIZATION", "INVITE_ONLY"]).default("PUBLIC"),
};

export const postFormSchema = z.object({
  kind: z.literal("post"),
  ...baseFields,
});

export const meetingFormSchema = z.object({
  kind: z.literal("meeting"),
  ...baseFields,
  scheduledAt: z.string().min(1, "Pick a date and time"),
  durationMinutes: optNum(z.number().int().min(5).max(60 * 24)),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  isOnline: z.boolean().default(false),
  meetingUrl: z.string().trim().url().optional().or(z.literal("")),
  videoLink: z.string().trim().url().optional().or(z.literal("")),

  // The monthly sadhana is the primary object on this site, so recurrence is
  // a first-class field rather than an advanced option.
  recurrencePattern: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).default("NONE"),
  recurrenceUntil: z.string().optional().or(z.literal("")),

  isRsvpEnabled: z.boolean().default(true),
  rsvpDeadline: z.string().optional().or(z.literal("")),
  attendeeLimit: optNum(z.number().int().min(1).max(10000)),
  minAttendees: optNum(z.number().int().min(1).max(10000)),
  notifyOnMinAttendees: z.boolean().default(false),
});

export const contentFormSchema = z.discriminatedUnion("kind", [
  postFormSchema,
  meetingFormSchema,
]);

/**
 * Two types, and the distinction matters at the boundary:
 *
 * - `ContentFormValues` is what the FORM sends. Number fields are strings
 *   there, because that's what an `<input type="number">` produces, and the
 *   optNum preprocessing above is what turns them into numbers.
 * - `ContentFormInput` is what comes out of a successful parse, with numbers
 *   as numbers and defaults applied. That's what the write path uses.
 *
 * Typing the action's parameter as the parsed shape would force the form to
 * pre-convert, duplicating exactly the coercion the schema already owns.
 */
export type ContentFormValues = z.input<typeof contentFormSchema>;
export type ContentFormInput = z.output<typeof contentFormSchema>;
export type PostFormInput = z.output<typeof postFormSchema>;
export type MeetingFormInput = z.output<typeof meetingFormSchema>;

/** URL-safe slug from a title. Uniqueness is enforced separately per org. */
export function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled"
  );
}
