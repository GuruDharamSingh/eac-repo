import type { TemplateKey } from './template-store';

// ============================================================================
// What a laid-out letter may say, and where each value comes from.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// An organisation that lays out its own "Registration confirmed" still needs
// the guest's name, the workshop, the date and the join link to land. Until
// now they could not: `renderAdvancedEmail` inserted the stored HTML verbatim,
// so whatever was on the canvas is what every recipient got — one person's
// name on everybody's confirmation.
//
// The network's own copy already speaks `{name}` (see `fill` in copy.ts), and
// this extends that same syntax to a laid-out body rather than inventing a
// second one. Deliberately dumb: no expressions, no conditionals, no loops. A
// template language inside an email body an org owner typed is a way to run
// someone else's code, and `fill` leaves an unknown `{typo}` visible so a bad
// key shows up in a test send instead of silently vanishing.
//
// ── One declaration, three readers ──────────────────────────────────────────
//
//   the send path   builds the values dict from the template's own props
//   the seeder      renders the letter with `{name}` IN PLACE OF values, so
//                   the editor opens on a real layout with live slots in it
//   the editor      lists what is available, so an owner is not guessing
//
// Adding a field here is what makes it substitutable, seedable and documented.
// ============================================================================

/** The zone every letter states its times in. Mirrors templates/rsvp-guest. */
const TZ = 'America/Toronto';

export interface MergeField {
  /** The token, written `{name}` in a body. */
  name: string;
  /** Shown in the editor's field list. */
  label: string;
  /**
   * What the seeded layout shows in its place.
   *
   * NOT a realistic value. The seeded body carries the literal `{token}`, and
   * this is only used for the preview iframe and the test send — where a real
   * name is what makes a proof-read useful.
   */
  sample: string;
  /** Pull the display value out of the template's props at send time. */
  from: (p: Record<string, unknown>) => string | undefined;
}

// ── value readers ────────────────────────────────────────────────────────────

const str = (key: string) => (p: Record<string, unknown>) => {
  const v = p[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
};

const num = (key: string) => (p: Record<string, unknown>) => {
  const v = p[key];
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : undefined;
};

/**
 * The date, formatted the way the letter itself formats it.
 *
 * There are three shapes across the suite and they are not interchangeable:
 * rsvp-guest states the year and the time, reminder drops the year (it is
 * about something days away), and meeting-trigger drops the time entirely.
 * The reader has to produce the SAME string the template wrote, or the seeder
 * cannot find it and the field silently fails to become a slot — a real date
 * stays baked into the layout and goes to every recipient.
 *
 * That failed silently for three fields until `check:fields` existed.
 */
type WhenShape = 'full' | 'noYear' | 'dateOnly';

const WHEN_OPTIONS: Record<WhenShape, Intl.DateTimeFormatOptions> = {
  full: {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: TZ, timeZoneName: 'short',
  },
  noYear: {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: TZ, timeZoneName: 'short',
  },
  dateOnly: {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: TZ,
  },
};

function when(key: string, shape: WhenShape = 'full') {
  return (p: Record<string, unknown>): string | undefined => {
    const v = p[key];
    if (typeof v !== 'string' || !v) return undefined;
    try {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return undefined;
      return shape === 'dateOnly'
        ? d.toLocaleDateString('en-CA', WHEN_OPTIONS.dateOnly)
        : d.toLocaleString('en-CA', WHEN_OPTIONS[shape]);
    } catch {
      return undefined;
    }
  };
}

const f = (
  name: string,
  label: string,
  sample: string,
  from?: MergeField['from']
): MergeField => ({ name, label, sample, from: from ?? str(name) });

// ── shared ───────────────────────────────────────────────────────────────────

/** On every letter, because the shell always knows it. */
const ORG: MergeField[] = [
  f('orgName', 'Organisation name', 'Your Organization'),
];

/**
 * The gathering itself.
 *
 * `when` is a parameter rather than part of the list because the letters
 * format the date differently, and the LINK to the thread is deliberately not
 * here: rsvp-guest calls it `threadUrl` and reminder calls it `rsvpUrl`, and
 * folding both into one shared entry gave two fields the same sample value —
 * so the seeder replaced one and left the other with nothing to find.
 */
const thread = (shape: WhenShape = 'full'): MergeField[] => [
  f('meetingTitle', 'Title of the gathering', 'The Fourth Way: Attention and the Moving Centre'),
  f('threadKind', 'What kind it is', 'workshop'),
  f('when', 'When it happens', 'Saturday, 3 October, 7:00 p.m. EDT', when('scheduledAt', shape)),
  f('location', 'Where', 'Toronto, and online'),
  f('summary', 'One line about it', 'Six weeks of practical work on divided attention.'),
  f('calendarUrl', 'Add-to-calendar link', 'https://example.org/api/calendar/sample.ics'),
];

// ── per letter ───────────────────────────────────────────────────────────────

export const MERGE_FIELDS: Record<string, MergeField[]> = {
  welcome: [
    ...ORG,
    f('displayName', 'Their name', 'Ada Whitfield'),
    f('email', 'Their email', 'ada@example.com'),
    f('username', 'Their handle', 'adaw'),
    f('confirmUrl', 'Confirm-email link', 'https://example.org/auth/confirm?token=sample'),
    // networkUrl / collectiveUrl are deliberately absent: they are network
    // constants with defaults inside the template, not per-recipient data. An
    // org laying this out writes whatever link it wants directly.
  ],

  provisioning: [
    ...ORG,
    f('displayName', 'Their name', 'Ada Whitfield'),
    f('claimUrl', 'Finish-setup link', 'https://cloud.elkdonis-arts.org/claim?token=sample'),
    f('nextcloudUsername', 'Their cloud login', 'ada.whitfield'),
    f('teamFolderName', 'Their team folder', 'EAC_Network/Your Organization'),
  ],

  'rsvp-guest': [
    ...ORG,
    f('guestName', 'Their name', 'Ada Whitfield'),
    ...thread(),
    f('threadUrl', 'Link to its page', 'https://example.org/workshops/attention'),
    f('talkRoomUrl', 'Join-the-room link', 'https://cloud.elkdonis-arts.org/call/sample'),
    f('materialsUrl', 'Materials link', 'https://cloud.elkdonis-arts.org/f/sample'),
    f('reminderSettingsUrl', 'Reminder settings link', 'https://example.org/account/reminders'),
  ],

  // No `reminderSettingsUrl`: this letter renders it in the FOOTER, which the
  // network keeps and a layout cannot reach. A field for something outside the
  // editable region is a slot an owner could place and that would then never
  // be filled.
  reminder: [
    ...ORG,
    f('guestName', 'Their name', 'Ada Whitfield'),
    ...thread('noYear'),
    f('rsvpUrl', 'Link to its page', 'https://example.org/workshops/attention'),
    f('talkJoinUrl', 'Join-the-room link', 'https://cloud.elkdonis-arts.org/call/sample'),
    f('rsvpCount', 'How many are coming', '7', num('rsvpCount')),
  ],

  // A plainer letter than the others: it carries no kind, no summary and no
  // add-to-calendar link, and it prints the date without a time. Fields for
  // those would be slots an owner could place that nothing would ever fill.
  // `confirmUrl` is absent for the same reason — the template only falls back
  // to it when `rsvpUrl` is missing, so it is never both declared and shown.
  // ORG is absent too: this letter names the organisation only in the header,
  // which the shell owns and a layout never sees. An owner laying this out can
  // simply type their own name — it is a constant for them, not a variable.
  'meeting-trigger': [
    f('guestName', 'Their name', 'Ada Whitfield'),
    f('senderName', 'Who sent it', 'Guru Dharam'),
    f('meetingTitle', 'Title of the gathering', 'The Fourth Way: Attention and the Moving Centre'),
    f('when', 'When it happens', 'Saturday, 3 October 2026', when('scheduledAt', 'dateOnly')),
    f('location', 'Where', 'Toronto, and online'),
    f('rsvpUrl', 'Link to its page', 'https://example.org/workshops/attention'),
    f('meetingUrl', 'Video-call link', 'https://cloud.elkdonis-arts.org/call/sample'),
    f('materialsUrl', 'Materials link', 'https://cloud.elkdonis-arts.org/f/sample'),
    f('rsvpCount', 'How many are coming', '7', num('rsvpCount')),
  ],

  // A newsletter is written, not triggered, so it has no per-recipient data
  // beyond who it is from. Listing orgName anyway keeps the editor's field
  // panel present rather than conditional.
  newsletter: [...ORG],
};

/** The fields a letter offers. Empty for a key with no laid-out path. */
export function mergeFieldsFor(key: TemplateKey | string): MergeField[] {
  return MERGE_FIELDS[key] ?? [];
}

/**
 * The values to substitute at send time, from a template's own props.
 *
 * A field the send had no value for is LEFT OUT rather than emptied, so `fill`
 * leaves its `{token}` in place. That is louder than a blank — a letter that
 * goes out saying `{talkRoomUrl}` is obviously broken, where a letter that
 * goes out with a hole where the join link should be looks fine and is not.
 */
export function mergeValuesFor(
  key: TemplateKey | string,
  props: Record<string, unknown>
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const field of mergeFieldsFor(key)) {
    const value = field.from(props);
    if (value !== undefined) out[field.name] = value;
  }
  return out;
}

/** `{name}` → a believable value, for the preview pane and test sends. */
export function sampleValuesFor(key: TemplateKey | string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of mergeFieldsFor(key)) out[field.name] = field.sample;
  return out;
}

/**
 * `{name}` → the literal token.
 *
 * What the seeder renders the letter with, so the layout that lands in the
 * editor has live slots in it rather than one person's details baked in.
 */
export function tokenValuesFor(key: TemplateKey | string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of mergeFieldsFor(key)) out[field.name] = `{${field.name}}`;
  return out;
}

/**
 * Substitute `{name}` tokens in a laid-out body.
 *
 * Same rule as `fill` in copy.ts — unknown keys survive untouched — but over
 * one HTML string rather than an array of paragraphs.
 *
 * ── Why the key match ignores case ──────────────────────────────────────────
 *
 * Several of the suite's cells are `text-transform: uppercase`, so a token
 * sitting in one DISPLAYS as `{THREADKIND}` in the editor while the HTML still
 * says `{threadKind}`. Substitution would work either way, but an owner who
 * reads the canvas and retypes what they see would produce a token that
 * matched nothing and shipped a letter with `{THREADKIND}` in it. Matching
 * case-insensitively costs nothing and removes the trap.
 *
 * The token an unknown key leaves behind keeps its original spelling, so a
 * genuine typo still reads as the typo it is.
 */
export function fillHtml(
  html: string,
  values?: Record<string, string | undefined>
): string {
  if (!values) return html;
  const byLower = new Map<string, string>();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) byLower.set(key.toLowerCase(), value);
  }
  return html.replace(
    /\{(\w+)\}/g,
    (whole, key: string) => byLower.get(key.toLowerCase()) ?? whole
  );
}
