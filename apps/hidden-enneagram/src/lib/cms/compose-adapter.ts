import type { ContentFormValues } from "@/lib/cms/schema";

// ============================================================================
// Shared compose answers → this site's save schema.
//
// `@elkdonis/cms-ui/compose` names fields the way the database does
// (`cover_image_url`, `feed_slug`); this app's zod schema uses camelCase.
// Neither is wrong, so the translation lives here — in one function, at the
// boundary — rather than as two vocabularies drifting through a shared
// component. Same shape as amrit-canada's adapter.
//
// This site's two kinds are `post` and `service`. A service is a sellable
// offering with a price and a booking type, so it carries a second block of
// fields the shared vocabulary does not name; those come through the
// composer's `extra` slot and are read from the same answers object.
// ============================================================================

export type ComposeAnswers = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function optStr(v: unknown): string | undefined {
  const s = str(v).trim();
  return s === "" ? undefined : s;
}
function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}
/** `optNum`/`reqNum` in the schema preprocess strings, so pass them through. */
function num(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  return String(v);
}

export function toContentFormValues(
  kind: string,
  answers: ComposeAnswers,
  status: "draft" | "published"
): ContentFormValues {
  const base = {
    feedSlug: str(answers.feed_slug),
    title: str(answers.title),
    excerpt: optStr(answers.excerpt),
    body: str(answers.body),
    coverImageUrl: optStr(answers.cover_image_url),
    status,
    // This site's schema allows PUBLIC | ORGANIZATION only — INVITE_ONLY means
    // "named people", which it has no mechanism for. Anything else lands PUBLIC
    // rather than failing a parse the author cannot see.
    visibility:
      str(answers.visibility) === "ORGANIZATION" ? "ORGANIZATION" : "PUBLIC",
  } as const;

  if (kind !== "service") {
    return { ...base, kind: "post" } as ContentFormValues;
  }

  return {
    ...base,
    kind: "service",
    subtitle: optStr(answers.subtitle),
    bookingType: (str(answers.booking_type) || "one_on_one") as
      | "one_on_one"
      | "group"
      | "async",
    format: optStr(answers.format) as "in_person" | "online" | "hybrid" | undefined,
    price: num(answers.price),
    currency: (optStr(answers.currency) || "CAD").toUpperCase(),
    slidingScale: bool(answers.sliding_scale),
    priceSlidingMin: num(answers.price_sliding_min),
    slidingScaleNote: optStr(answers.sliding_scale_note),
    sessionCount: num(answers.session_count),
    sessionDurationHrs: num(answers.session_duration_hrs),
    recurrenceLabel: optStr(answers.recurrence_label),
    location: optStr(answers.location),
    bannerImageUrl: optStr(answers.banner_image_url),
    registrationStatus: (str(answers.registration_status) || "open") as
      | "open"
      | "waitlist"
      | "full"
      | "closed",
  } as ContentFormValues;
}
