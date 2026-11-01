import {
  knownTimeZone,
  localTimeZone,
  orderedDisplayZones,
  seriesScheduleFromAnswers,
  wallClockToInstant,
} from "@elkdonis/cms-ui/compose";
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
//
// Dates (2026-10-10): the form holds wall-clock strings in its `time_zone`
// ("2026-10-12T18:00"). They are turned into instants HERE, in that zone, and
// the action receives ISO strings with an offset. Before, the raw string went
// to a `timestamptz` column and Postgres read it in the session zone (UTC),
// so a meeting typed as 18:00 Toronto was stored as 18:00 UTC (14:00
// Toronto). An empty zone is the browser's own, which is what the zone field
// says when nothing is chosen ("Your zone — …").
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

/** The zone the form's wall-clock fields are read in. */
export function formTimeZone(answers: ComposeAnswers): string {
  return knownTimeZone(optStr(answers.time_zone)) ?? localTimeZone();
}

/** A wall-clock answer as an ISO instant in `zone`, or null. */
function instant(value: unknown, zone: string): string | null {
  return wallClockToInstant(optStr(value), zone)?.toISOString() ?? null;
}

/** "YYYY-MM-DD" + one day. */
function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
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

  const zone = formTimeZone(answers);

  if (kind === "series") return toSeriesInput(answers, base, zone);

  return {
    ...base,
    kind: kind as IfacComposeKind,
    timeZone: zone,
    scheduledAt: instant(answers.scheduled_at, zone),
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
    recurrencePattern: optStr(answers.recurrence_pattern) === "NONE"
      ? null
      : (optStr(answers.recurrence_pattern) as "DAILY" | "WEEKLY" | "MONTHLY" | null),
    // A date: midnight at the start of that day in the form's zone, which the
    // edit form reads back as the same date.
    recurrenceUntil: instant(answers.recurrence_until, zone),
    // Prose, not a parsed rule. `threads.recurrence_custom_rule` already
    // existed and had no writer; the calendar still runs off the pattern.
    recurrenceCustomRule: optStr(answers.recurrence_custom_rule),
    // The two rooms a gathering can be given. Both are acted on AFTER the
    // thread exists (saveContentAction), because each needs its id.
    createTalkRoom: bool(answers.create_talk_room),
    createDocument: bool(answers.create_document),
    // "Who's hosting": undefined when the form had no such field (no
    // candidates), "" when someone chose "Nobody" — the two mean different
    // things, so they are kept apart. See assignNextHosts.
    hostUserId: answers.host_user_id === undefined ? undefined : str(answers.host_user_id),
    coHostUserId: answers.co_host_user_id === undefined ? undefined : str(answers.co_host_user_id),
  };
}

/**
 * A meeting series (2026-10-10). The first session's instant and the
 * exclusive end (`recurrence_until` = the start of the day after the last
 * session, in the series' zone) are computed the way services'
 * `saveSeriesSchedule` computes them, so a draft row and a published one
 * carry the same columns. The schedule strings go along for
 * `saveSeriesSchedule`, which recomputes both on publish.
 *
 * No `body`, `meeting_url` or hosts: the series page prints the lede, the
 * join link lives in `metadata.joinDetails` (members only), and hosts are
 * set per week in the planner.
 */
function toSeriesInput(
  answers: ComposeAnswers,
  base: Omit<SaveContentInput, "kind">,
  zone: string
): SaveContentInput {
  const { schedule } = seriesScheduleFromAnswers({ ...answers, time_zone: zone });
  const lede = optStr(answers.lede);
  const joinUrl = optStr(answers.join_url);
  const editing = answers.series_editing === true;
  return {
    ...base,
    body: undefined,
    excerpt: lede ?? undefined,
    kind: "series",
    timeZone: zone,
    scheduledAt: instant(answers.scheduled_at, zone),
    durationMinutes: optNum(answers.duration_minutes) ?? 60,
    format: "online",
    isRsvpEnabled: true,
    recurrencePattern: "WEEKLY",
    recurrenceUntil: schedule?.lastDate ? instant(nextDay(schedule.lastDate), zone) : null,
    createTalkRoom: !joinUrl && bool(answers.create_talk_room),
    series: {
      editing,
      schedule,
      lede,
      // Not loaded into an edit form (see defaultThreadToAnswers), so not
      // written from one: undefined leaves them as stored.
      ...(editing
        ? {}
        : {
            joinUrl,
            meetingId: joinUrl ? optStr(answers.join_meeting_id) : null,
            passcode: joinUrl ? optStr(answers.join_passcode) : null,
            otherWaysToJoin: joinUrl ? optStr(answers.join_other) : null,
            reminderDays: optNum(answers.reminder_days) ?? 2,
            alsoZones: orderedDisplayZones(answers.also_zones),
          }),
    },
  };
}
