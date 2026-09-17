import type { SaveContentInput } from "@/lib/cms/actions";

// ============================================================================
// Shared compose answers → IFAC's save input.
//
// `@elkdonis/cms-ui/compose` names its fields the way the database does
// (`scheduled_at`, `cover_image_url`, `is_rsvp_enabled`); `saveContentAction`
// takes camelCase. Neither is wrong and neither is worth renaming under live
// data, so the translation lives here, at the boundary — one function, rather
// than two vocabularies drifting through a shared component.
//
// Modelled on amrit-canada's `toContentFormValues`, which does the same job
// against that site's zod schema. The shape differs because the save paths
// differ; the seam is in the same place, and deliberately so.
// ============================================================================

/** Answers the shared composer produces. */
export type ComposeAnswers = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function optStr(value: unknown): string | null {
  const s = str(value).trim();
  return s === "" ? null : s;
}

function optNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * The kinds IFAC can save. The shared catalogue's "article" writes `post`,
 * and everything else writes its own name.
 */
export type IfacComposeKind = SaveContentInput["kind"];

export function toSaveContentInput(
  kind: string,
  answers: ComposeAnswers,
  status: "draft" | "published"
): SaveContentInput {
  const base = {
    title: str(answers.title),
    body: str(answers.body) || undefined,
    excerpt: optStr(answers.excerpt) ?? undefined,
    status,
    section: optStr(answers.feed_slug),
    coverImageUrl: optStr(answers.cover_image_url),
  };

  // Undated: a post carries no schedule, and passing one through would make
  // `saveContentAction` treat it as an event.
  if (kind === "post") {
    return { ...base, kind: "post" };
  }

  return {
    ...base,
    kind: kind as IfacComposeKind,
    scheduledAt: optStr(answers.scheduled_at),
    durationMinutes: optNum(answers.duration_minutes) ?? 60,
    location: optStr(answers.location),
    // The shared vocabulary carries `format` (in_person | online | hybrid) and
    // so does IFAC, so this one passes straight through.
    format:
      (optStr(answers.format) as "in_person" | "online" | "hybrid" | null) ??
      "online",
    meetingUrl: optStr(answers.meeting_url),
    isRsvpEnabled: bool(answers.is_rsvp_enabled, true),
    attendeeLimit: optNum(answers.attendee_limit),
    // 'NONE' is NOT a legal value for the column — the CHECK accepts null or
    // one of four patterns — and the composer's "does not repeat" option is
    // the empty string, which `optStr` already turns into null.
    recurrencePattern: optStr(answers.recurrence_pattern) as
      | "DAILY"
      | "WEEKLY"
      | "MONTHLY"
      | null,
    recurrenceUntil: optStr(answers.recurrence_until),
    // Prose, not a parsed rule. `threads.recurrence_custom_rule` already
    // existed and had no writer; the calendar still runs off the pattern.
    recurrenceCustomRule: optStr(answers.recurrence_custom_rule),
  };
}
