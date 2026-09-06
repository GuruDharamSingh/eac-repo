import { z } from "zod";

/**
 * Content form schemas.
 *
 * Same shape as amrit-canada's (discriminated union on `kind` over a shared
 * baseFields, every piece of content naming the FEED it publishes to) so the
 * two sites create content the same way and the pattern is worth learning
 * once. The kinds differ because the sites sell different things:
 *
 *   post    — writing. Title, body, cover image.
 *   service — a sellable offering (reading, workshop, lesson). Everything a
 *             post has, plus pricing and booking state, written through to
 *             the workshop_pages sidecar by upsertServiceOffering.
 *
 * amrit's `meeting` kind is deliberately absent: this site books paid
 * sessions through commerce orders, not RSVPs.
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

/** Same string→number coercion as optNum, but for a required field. */
function reqNum(schema: z.ZodNumber) {
  return z.preprocess((v) => (typeof v === "number" ? v : Number(v)), schema);
}

const baseFields = {
  /** org_feeds.slug — which section of the site this appears in. */
  feedSlug: z.string().min(1, "Choose which page this goes on"),
  title: z.string().trim().min(2, "Give it a title").max(200),
  /** Short summary for cards and link previews. */
  excerpt: z.string().trim().max(280).optional().or(z.literal("")),
  /** HTML from the Tiptap editor. */
  body: z.string().optional().or(z.literal("")),
  // Produced by the media picker (an /api/media/... path), or empty. Not a
  // full URL, so no .url() here.
  coverImageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  status: z.enum(["draft", "published"]).default("draft"),
  visibility: z.enum(["PUBLIC", "ORGANIZATION"]).default("PUBLIC"),
};

export const postFormSchema = z.object({
  kind: z.literal("post"),
  ...baseFields,
});

export const serviceFormSchema = z.object({
  kind: z.literal("service"),
  ...baseFields,
  subtitle: z.string().trim().max(160).optional().or(z.literal("")),

  bookingType: z.enum(["one_on_one", "group", "async"]).default("one_on_one"),
  format: z.enum(["in_person", "online", "hybrid"]).optional(),

  price: reqNum(z.number().min(0.01, "Set a price")),
  currency: z.string().trim().length(3).default("CAD"),
  slidingScale: z.boolean().default(false),
  priceSlidingMin: optNum(z.number().min(0)),
  slidingScaleNote: z.string().trim().max(300).optional().or(z.literal("")),

  sessionCount: optNum(z.number().int().min(1).max(500)),
  sessionDurationHrs: optNum(z.number().min(0.25).max(48)),
  recurrenceLabel: z.string().trim().max(120).optional().or(z.literal("")),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  bannerImageUrl: z.string().trim().max(500).optional().or(z.literal("")),

  registrationStatus: z.enum(["open", "waitlist", "full", "closed"]).default("open"),
});

/**
 * The sliding-scale check lives on the union rather than on the service
 * object: z.discriminatedUnion only accepts plain ZodObjects, and .refine()
 * would wrap it in a ZodEffects that the union can't discriminate on.
 */
export const contentFormSchema = z
  .discriminatedUnion("kind", [postFormSchema, serviceFormSchema])
  .superRefine((data, ctx) => {
    if (data.kind !== "service" || !data.slidingScale) return;
    if (data.priceSlidingMin == null || data.priceSlidingMin >= data.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceSlidingMin"],
        message: "The sliding-scale floor must be set and less than the list price",
      });
    }
  });

/**
 * Two types, and the distinction matters at the boundary:
 *
 * - `ContentFormValues` is what the FORM sends. Number fields are strings
 *   there, because that's what an `<input type="number">` produces, and the
 *   reqNum/optNum preprocessing above is what turns them into numbers.
 * - `ContentFormInput` is what comes out of a successful parse, with numbers
 *   as numbers and defaults applied. That's what the write path uses.
 */
export type ContentFormValues = z.input<typeof contentFormSchema>;
export type ContentFormInput = z.output<typeof contentFormSchema>;
export type PostFormInput = z.output<typeof postFormSchema>;
export type ServiceFormInput = z.output<typeof serviceFormSchema>;

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
