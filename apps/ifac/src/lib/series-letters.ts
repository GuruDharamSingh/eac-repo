/**
 * IFAC's per-series letters: which letters a series can have its own version
 * of, and the stored key each one saves to. Data only (no database), so the
 * client connectors and the server routes share one list.
 *
 * A series' version of a letter is an `email_template_settings` row keyed
 * `<templateKey>:<scope>`: `reminder:<seriesId>:<purpose>` for the four
 * reminders, `rsvp-guest:<seriesId>` for the confirmation. The senders pass
 * the matching `templateScope` (`lib/reminders.ts`, `lib/series-mail.ts`), and
 * `resolveOrgTemplate` tries the scoped key before IFAC's own.
 * Design: docs/open/SERIES_EMAIL_DESIGN_2026-10-10.md sections 2, 3 and step 4.
 */

export const REMINDER_PURPOSES = ["attendee", "subscriber", "host", "host-assigned"] as const;
export type SeriesReminderPurpose = (typeof REMINDER_PURPOSES)[number];

export type SeriesLetterKey = "rsvp-guest" | "reminder" | "rsvp-owner";

export interface SeriesLetter {
  /** `<key>` or `<key>:<purpose>`; the suite's letter key on the series page. */
  id: string;
  key: SeriesLetterKey;
  purpose?: SeriesReminderPurpose;
  title: string;
  trigger: string;
  recipient: string;
  /** False for the host notice, which has no per-series version. */
  editable: boolean;
}

export const SERIES_LETTERS: SeriesLetter[] = [
  {
    id: "rsvp-guest",
    key: "rsvp-guest",
    title: "Confirmation",
    trigger: "Someone says they are coming to a week of this series",
    recipient: "The person coming",
    editable: true,
  },
  {
    id: "reminder:attendee",
    key: "reminder",
    purpose: "attendee",
    title: "Attendee reminder",
    trigger: "The day before a week, and again shortly before it starts",
    recipient: "Everyone coming to that week",
    editable: true,
  },
  {
    id: "reminder:subscriber",
    key: "reminder",
    purpose: "subscriber",
    title: "Subscriber letter",
    trigger: "A set number of days before each week (2 unless the series says otherwise)",
    recipient: "Everyone subscribed to the series",
    editable: true,
  },
  {
    id: "reminder:host",
    key: "reminder",
    purpose: "host",
    title: "Host reminder",
    trigger: "Within the hour before a week starts",
    recipient: "That week's host and co-host",
    editable: true,
  },
  {
    id: "reminder:host-assigned",
    key: "reminder",
    purpose: "host-assigned",
    title: "Host assigned",
    trigger: "Someone is put down to host or co-host a week",
    recipient: "The new host",
    editable: true,
  },
  {
    id: "rsvp-owner",
    key: "rsvp-owner",
    title: "Host notice",
    trigger: "Someone says they are coming",
    recipient: "Whoever runs IFAC",
    editable: false,
  },
];

export function seriesLetterById(id: string): SeriesLetter | undefined {
  return SERIES_LETTERS.find((l) => l.id === id);
}

/** Thread ids are nanoids (inner_group's carry a `th_` prefix); never a `:`. */
const SERIES_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface SeriesLetterScope {
  seriesId: string;
  key: "rsvp-guest" | "reminder";
  purpose?: SeriesReminderPurpose;
  /** The row this series' version is stored in, e.g. `reminder:<id>:subscriber`. */
  scopedKey: string;
  /** The sender's chain, most specific first (`templateScope`). */
  scopes: string[];
  /** The chain after the scoped key: where an unsaved series letter starts from. */
  fallbackScopes: string[];
  letter: SeriesLetter;
}

/**
 * Check `?series=&purpose=` against the letter key. Shape only: whether the
 * series belongs to IFAC is checked against the database by the caller
 * (`findIfacSeries`).
 *
 * - `reminder` needs a purpose from `REMINDER_PURPOSES`;
 * - `rsvp-guest` takes none;
 * - every other key has no per-series version.
 */
export function parseSeriesLetter(
  key: string,
  series: string | null | undefined,
  purpose: string | null | undefined
): { ok: true; scope: SeriesLetterScope } | { ok: false; status: number; error: string } {
  if (!series || !SERIES_ID.test(series)) {
    return { ok: false, status: 400, error: "Unknown series" };
  }
  if (key === "reminder") {
    if (!purpose || !(REMINDER_PURPOSES as readonly string[]).includes(purpose)) {
      return { ok: false, status: 400, error: "Unknown reminder" };
    }
    const p = purpose as SeriesReminderPurpose;
    return {
      ok: true,
      scope: {
        seriesId: series,
        key,
        purpose: p,
        scopedKey: `reminder:${series}:${p}`,
        scopes: [`${series}:${p}`, series],
        fallbackScopes: [series],
        letter: seriesLetterById(`reminder:${p}`)!,
      },
    };
  }
  if (key === "rsvp-guest") {
    if (purpose) return { ok: false, status: 400, error: "The confirmation has no purpose" };
    return {
      ok: true,
      scope: {
        seriesId: series,
        key,
        scopedKey: `rsvp-guest:${series}`,
        scopes: [series],
        fallbackScopes: [],
        letter: seriesLetterById("rsvp-guest")!,
      },
    };
  }
  return { ok: false, status: 400, error: "This letter has no per-series version" };
}

/** The line shown above a series letter's editor. */
export function seriesScopeNote(letterTitle: string, seriesTitle: string): string {
  return `Editing the ${letterTitle.toLowerCase()} for ${seriesTitle}. Other series and the IFAC default are unchanged.`;
}

/** The page that edits one series' letters. */
export function seriesLettersHref(seriesId: string): string {
  return `/manage/email/series/${encodeURIComponent(seriesId)}`;
}

/** This series' letters in the email suite (`/manage/email/series/[id]`). */
export const seriesEmailsHref = (threadId: string) => `/manage/email/series/${encodeURIComponent(threadId)}`;
/** Its "Mailings to this series" section, where a mailing is written. */
export const seriesMailingsHref = (threadId: string) => `${seriesEmailsHref(threadId)}#mailings`;
