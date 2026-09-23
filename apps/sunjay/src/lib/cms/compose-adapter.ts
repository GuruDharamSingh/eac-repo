import type { ContentFormValues } from "@/lib/cms/schema";

// ============================================================================
// Shared compose answers → this site's save schema.
//
// `@elkdonis/cms-ui/compose` names fields the way the database does
// (`scheduled_at`, `cover_image_url`, `is_rsvp_enabled`); this app's zod
// schema uses camelCase (`scheduledAt`, `coverImageUrl`, `isRsvpEnabled`).
// Neither is wrong and neither is worth a rename under live data, so the
// translation lives here — in one function, at the boundary, rather than as
// two vocabularies drifting through a shared component.
//
// This is also where this site's own fields land: recurrence, RSVP deadlines
// and minimum attendance are first-class here (the monthly sadhana is the
// primary object on the site) and are supplied by the composer's `extra` slot.
// ============================================================================

/** Answers the shared composer produces, plus this site's extras. */
export type ComposeAnswers = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function optStr(value: unknown): string | undefined {
  const s = str(value).trim();
  return s === "" ? undefined : s;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * `optNum` in the schema preprocesses strings, so numbers are passed through
 * as strings rather than coerced here — one place decides how "" becomes
 * undefined, and it is the schema.
 */
function num(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  return String(value);
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
    materialIds: Array.isArray(answers.material_ids)
      ? (answers.material_ids as unknown[]).map(String)
      : [],
    createDocument: bool(answers.create_document),
    createTalkRoom: bool(answers.create_talk_room),
    status,
    visibility: (str(answers.visibility) || "PUBLIC") as
      | "PUBLIC"
      | "ORGANIZATION"
      | "INVITE_ONLY",
  };

  if (kind !== "meeting") {
    return { ...base, kind: "post" } as ContentFormValues;
  }

  return {
    ...base,
    kind: "meeting",
    scheduledAt: str(answers.scheduled_at),
    timeZone: optStr(answers.time_zone),
    durationMinutes: num(answers.duration_minutes),
    location: optStr(answers.location),
    // The shared vocabulary carries `format` (in_person | online | hybrid);
    // this site stores a boolean. Hybrid counts as online, because what the
    // flag drives is whether a joining link is shown.
    isOnline: str(answers.format) !== "in_person",
    meetingUrl: optStr(answers.meeting_url),
    videoLink: optStr(answers.video_link),
    recurrencePattern: (str(answers.recurrence_pattern) || "NONE") as
      | "NONE"
      | "DAILY"
      | "WEEKLY"
      | "MONTHLY",
    recurrenceUntil: optStr(answers.recurrence_until),
    isRsvpEnabled: bool(answers.is_rsvp_enabled, true),
    rsvpDeadline: optStr(answers.rsvp_deadline),
    attendeeLimit: num(answers.attendee_limit),
    minAttendees: num(answers.min_attendees),
    notifyOnMinAttendees: bool(answers.notify_on_min_attendees),
  } as ContentFormValues;
}
