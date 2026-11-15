// ============================================================================
// Unit check for the forms' rules, readers and kind schemas (soft tissue).
// Pure: no DOM, no data. Run inside the admin container:
//
//   ssh eris 'cd ~/eac && sudo -n docker compose run --rm --no-deps -w /app/packages/studio-forms admin \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs src/forms/rules/check.ts'
//
// Exits 1 on the first failed group's end, printing every failure.
// ============================================================================

import type { Answers, FormContext, FormKindSchema, FormRule } from '../contract';
import { computeIssues } from '../state';
import { postKind, POST_SAMPLE, POST_SAMPLE_CONTEXT } from '../kinds/post';
import { alsoShowOnSummary, excerptSummary } from '../kinds/post/sections';
import {
  meetingKind,
  MEETING_ERRORS_SAMPLE,
  MEETING_REPEAT_SAMPLE,
  MEETING_SAMPLE,
  MEETING_SAMPLE_CONTEXT,
  emailsSummary,
  hostsSummary,
  publishingSummary,
  rsvpSummary,
  whenHint,
  whenRepeatSummary,
} from '../kinds/meeting';
import { visibleSections } from '../state';
import {
  durationLabel,
  endTime,
  repeatSummary,
  sessionCount,
  startHasPassed,
  untilForCount,
  whereEncode,
  zoneLabel,
} from './answers';
import { checkKinds } from './check-kinds';
import { resolveMeetingAnswers, whereModeOf } from '../adapters/meeting';
import { MEETING_RULES } from './meeting';
import { rulesFor } from './index';
import { POST_RULES } from './post';

let failed = 0;
let passed = 0;

function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name}\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`);
  }
}

function rule(rules: FormRule[], id: string): FormRule {
  const r = rules.find((x) => x.id === id);
  if (!r) throw new Error(`no rule ${id}`);
  return r;
}

/** `fails` = the rule's test returns true (the rule FAILS, so an issue is raised). */
function cases(rules: FormRule[], id: string, ctx: FormContext, base: Answers, list: Array<[string, Partial<Answers>, boolean]>) {
  const r = rule(rules, id);
  for (const [label, patch, fails] of list) eq(`${id}: ${label}`, r.test({ ...base, ...patch }, ctx), fails);
}

const G = MEETING_SAMPLE_CONTEXT;
const g = MEETING_SAMPLE;

// ── meeting rules ──────────────────────────────────────────────────────────

cases(MEETING_RULES, 'meeting.title', G, g, [
  ['empty', { title: '' }, true],
  ['one letter', { title: 'A' }, true],
  ['spaces', { title: '   ' }, true],
  ['a title', { title: 'Open studio' }, false],
]);

cases(MEETING_RULES, 'meeting.date', G, g, [
  ['no date', { scheduled_at: '' }, true],
  ['date only', { scheduled_at: '2026-11-19' }, false],
  ['date and time', { scheduled_at: '2026-11-19T18:30' }, false],
]);

cases(MEETING_RULES, 'meeting.time', G, g, [
  ['date only, no preset time', { scheduled_at: '2026-11-19', start_time: undefined }, true],
  ['date only, preset start_time', { scheduled_at: '2026-11-19', start_time: '18:30' }, false],
  ['wall clock', { scheduled_at: '2026-11-19T18:30', start_time: undefined }, false],
  ['nothing at all', { scheduled_at: '', start_time: undefined }, true],
]);

// now = 2026-11-10 12:04 in Toronto
cases(MEETING_RULES, 'meeting.past', G, g, [
  ['5 Nov, new form', { scheduled_at: '2026-11-05T18:30' }, true],
  ['5 Nov, loaded and unchanged', { scheduled_at: '2026-11-05T18:30', 'forms.loaded_start': '2026-11-05T18:30' }, false],
  ['5 Nov, loaded as 4 Nov (changed)', { scheduled_at: '2026-11-05T18:30', 'forms.loaded_start': '2026-11-04T18:30' }, true],
  ['today 11:00 (passed)', { scheduled_at: '2026-11-10T11:00' }, true],
  ['today 13:00 (to come)', { scheduled_at: '2026-11-10T13:00' }, false],
  ['yesterday, date only', { scheduled_at: '2026-11-09', start_time: undefined }, true],
  ['today, date only', { scheduled_at: '2026-11-10', start_time: undefined }, false],
  ['19 Nov', { scheduled_at: '2026-11-19T18:30' }, false],
  ['no date', { scheduled_at: '' }, false],
  ['standing meeting from 2024, loaded', { scheduled_at: '2024-01-04T19:00', recurrence_pattern: 'WEEKLY', 'forms.loaded_start': '2024-01-04T19:00' }, false],
]);
// 17:30 in Paris is 16:30 UTC, before now (17:04 UTC); 17:30 in Toronto is 22:30 UTC, still to come.
eq('startHasPassed reads the meeting’s own zone', startHasPassed({ scheduled_at: '2026-11-10T17:30', time_zone: 'Europe/Paris' }, G), true);
eq('startHasPassed, same wall clock in Toronto is still to come', startHasPassed({ scheduled_at: '2026-11-10T17:30', time_zone: 'America/Toronto' }, G), false);

cases(MEETING_RULES, 'meeting.duration', G, g, [
  ['2h', { duration_minutes: 120 }, false],
  ['4 min', { duration_minutes: 4 }, true],
  ['25 h', { duration_minutes: 1500 }, true],
  ['empty', { duration_minutes: '' }, false],
  ['as a string', { duration_minutes: '45' }, false],
]);

cases(MEETING_RULES, 'meeting.until', G, g, [
  ['weekly, until a week before', { recurrence_pattern: 'WEEKLY', recurrence_until: '2026-11-12T23:59' }, true],
  ['weekly, until the start day 23:59', { recurrence_pattern: 'WEEKLY', recurrence_until: '2026-11-19T23:59' }, false],
  ['weekly, until a bare date before', { recurrence_pattern: 'WEEKLY', recurrence_until: '2026-11-19' }, true],
  ['not repeating', { recurrence_pattern: 'NONE', recurrence_until: '2026-11-01' }, false],
]);

cases(MEETING_RULES, 'meeting.where', G, g, [
  ['place, no address', { where_mode: 'place', location: '' }, true],
  ['place, an address', { where_mode: 'place', location: 'Studio 4' }, false],
  ['link mode', { where_mode: 'link', location: '' }, false],
  ['talk mode', { where_mode: 'talk', location: '' }, false],
  ['no where_mode, in person, empty (derived place)', { where_mode: undefined, format: 'in_person', location: '' }, true],
  ['no where_mode, online + Talk room preset', { where_mode: undefined, format: 'online', create_talk_room: true, location: '' }, false],
  ['place + Talk room, no address', { where_mode: 'place+talk', location: '' }, true],
  ['place + link, an address', { where_mode: 'place+link', location: 'Studio 4', meeting_url: 'https://x.org' }, false],
]);

cases(MEETING_RULES, 'meeting.where-none', G, g, [
  ['nothing ticked', { where_mode: 'none' }, true],
  ['a place', { where_mode: 'place', location: 'Studio 4' }, false],
  ['a Talk room', { where_mode: 'talk' }, false],
]);

cases(MEETING_RULES, 'meeting.link-empty', G, g, [
  ['link, empty', { where_mode: 'link', meeting_url: '' }, true],
  ['link, spaces', { where_mode: 'link', meeting_url: '  ' }, true],
  ['link, a URL', { where_mode: 'link', meeting_url: 'https://meet.jit.si/elkdonis-open-studio' }, false],
  ['talk', { where_mode: 'talk', meeting_url: '' }, false],
  ['place without a link', { where_mode: 'place', meeting_url: '' }, false],
  ['place + link, empty', { where_mode: 'place+link', meeting_url: '' }, true],
  ['place + Talk room', { where_mode: 'place+talk', meeting_url: '' }, false],
]);

cases(MEETING_RULES, 'meeting.link-invalid', G, g, [
  ['link, no scheme', { where_mode: 'link', meeting_url: 'meet.jit.si/x' }, true],
  ['link, https', { where_mode: 'link', meeting_url: 'https://meet.jit.si/x' }, false],
  ['place + link, ftp', { where_mode: 'place+link', meeting_url: 'ftp://x.org' }, true],
  ['place only ignores a stale link', { where_mode: 'place', meeting_url: 'ftp://x.org' }, false],
  ['talk ignores the link', { where_mode: 'talk', meeting_url: 'junk' }, false],
  ['empty is the other rule', { where_mode: 'link', meeting_url: '' }, false],
]);

// Where (2026-11-14): what is saved for each choice, and what a loaded meeting reads as.
const resolved = (w: string, extra: Answers = {}) => {
  const r = resolveMeetingAnswers({ location: 'Studio 4', meeting_url: 'https://meet.jit.si/x', ...extra, where_mode: w }).answers;
  return [r.format, r.location, r.meeting_url, r.create_talk_room];
};
eq('resolve place', resolved('place'), ['in_person', 'Studio 4', '', false]);
eq('resolve place + link', resolved('place+link'), ['hybrid', 'Studio 4', 'https://meet.jit.si/x', false]);
eq('resolve place + Talk room', resolved('place+talk'), ['hybrid', 'Studio 4', '', true]);
eq('resolve link', resolved('link'), ['online', '', 'https://meet.jit.si/x', false]);
eq('resolve Talk room', resolved('talk'), ['online', '', '', true]);
eq('encode: a link and a Talk room keep the room', whereEncode({ place: false, link: true, talk: true }), 'talk');
eq('loaded hybrid with a room reads place + Talk room', whereModeOf({ format: 'hybrid', location: 'Studio 4', create_talk_room: true, meeting_url: '' }), 'place+talk');
eq('loaded hybrid with a link reads place + link', whereModeOf({ format: 'hybrid', location: 'Studio 4', meeting_url: 'https://x.org' }), 'place+link');
eq('loaded online without a link reads Talk room', whereModeOf({ format: 'online', meeting_url: '' }), 'talk');

cases(MEETING_RULES, 'meeting.reminder-range', G, g, [
  ['never asked', { reminder_minutes_before: undefined }, false],
  ['off', { reminder_minutes_before: null }, false],
  ['a day', { reminder_minutes_before: 1440 }, false],
  ['4 minutes', { reminder_minutes_before: 4 }, true],
  ['two weeks', { reminder_minutes_before: 20160 }, false],
  ['two weeks and a minute', { reminder_minutes_before: 20161 }, true],
  ['not whole', { reminder_minutes_before: 90.5 }, true],
]);

cases(MEETING_RULES, 'meeting.recording-invalid', G, g, [
  ['none', { video_link: '' }, false],
  ['https', { video_link: 'https://vimeo.com/1' }, false],
  ['no scheme', { video_link: 'vimeo.com/1' }, true],
]);

cases(MEETING_RULES, 'meeting.min-over-cap', G, g, [
  ['12 over 10', { min_attendees: 12, attendee_limit: 10 }, true],
  ['6 under 24', { min_attendees: 6, attendee_limit: 24 }, false],
  ['12, no cap', { min_attendees: 12, attendee_limit: undefined }, false],
  ['RSVPs off', { min_attendees: 12, attendee_limit: 10, is_rsvp_enabled: false }, false],
  ['strings from inputs', { min_attendees: '12', attendee_limit: '10' }, true],
]);

// Series in place (pass 2) was checked here until 2026-11-14, when series left the meeting form
// (docs/open/STUDIO_FORMS_SPLIT_2026-11-14.md §7). rules/series.ts is kept for the series kind
// (§4 step 3), which brings its own checks.

// ── post rules ───────────────────────────────────────────────────────────────

const P = POST_SAMPLE_CONTEXT;
const p = POST_SAMPLE;

cases(POST_RULES, 'post.title', P, p, [
  ['empty', { title: '' }, true],
  ['a title', { title: 'Notes' }, false],
]);

cases(POST_RULES, 'post.listing-public', P, p, [
  ['members + another site', { visibility: 'ORGANIZATION', also_on: ['sample-inner'] }, true],
  ['public + another site', { visibility: 'PUBLIC', also_on: ['sample-inner'] }, false],
  ['members, nowhere else', { visibility: 'ORGANIZATION', also_on: [] }, false],
  ['members, home only', { visibility: 'ORGANIZATION', also_on: ['sample-eac'] }, false],
]);

// ── readers ──────────────────────────────────────────────────────────────────

eq('untilForCount: 8 Thursdays from 19 Nov', untilForCount({ ...g, recurrence_pattern: 'WEEKLY' }, G, 8), '2027-01-07T23:59');
eq('untilForCount: not repeating has no last session', untilForCount(g, G, 8), '');
eq('repeat sample carries the 8th Thursday', MEETING_REPEAT_SAMPLE.recurrence_until, '2027-01-07T23:59');
eq('untilForCount: 3 monthly (third Thursday)', untilForCount({ ...g, recurrence_pattern: 'MONTHLY' }, G, 3), '2027-01-21T23:59');
eq('sessionCount derived back from a bare until', sessionCount({ ...g, recurrence_pattern: 'WEEKLY', recurrence_until: '2027-01-07' }, G), 8);
eq('sessionCount from forms.repeat_count', sessionCount(MEETING_REPEAT_SAMPLE, G), 8);
eq('repeatSummary weekly', repeatSummary(MEETING_REPEAT_SAMPLE, G), 'Every week on Thursday, 8 sessions');
eq('repeatSummary off', repeatSummary(g, G), 'Does not repeat');
eq('repeatSummary monthly', repeatSummary({ ...g, recurrence_pattern: 'MONTHLY' }, G), 'Every month on the third Thursday');
eq('repeatSummary until', repeatSummary({ ...g, recurrence_pattern: 'DAILY', recurrence_until: '2027-01-21T23:59' }, G), 'Every day, until 21 Jan');
eq('endTime', endTime('18:30', 120), '20:30');
eq('endTime past midnight', endTime('23:30', 60), '00:30 the next day');
eq('durationLabel 90', durationLabel(90), '1½h');
eq('durationLabel 45', durationLabel(45), '45 min');
eq('durationLabel 150', durationLabel(150), '2½h');
eq('zoneLabel Toronto', zoneLabel('America/Toronto'), 'Eastern time (Toronto)');
eq('whenHint', whenHint(g, 'America/Toronto'), 'Ends 20:30 · Eastern time (Toronto)');

// ── summaries (the design's More-row lines) ─────────────────────────────────

eq('rsvp summary', rsvpSummary(g), '24 places · closes when it starts');
eq('rsvp summary, warning', rsvpSummary(MEETING_ERRORS_SAMPLE), 'Needs 12 to go ahead, but only 10 places');
eq('rsvp summary, off', rsvpSummary({ ...g, is_rsvp_enabled: false }), 'No RSVPs');
eq('emails summary', emailsSummary(g), 'A reminder a day before');
eq('emails summary, never asked', emailsSummary({ ...g, reminder_minutes_before: undefined }), 'No reminder');
eq('hosts summary', hostsSummary(g, G), 'Mara Okafor');
eq('hosts summary, nobody', hostsSummary({ ...g, host_user_id: undefined }, G), 'Nobody yet');
eq('publishing summary', publishingSummary(g, G), 'Public · Lab work · Elkdonis Arts Collective');
eq('excerpt summary', excerptSummary(p), 'From the opening of the body');
eq('also show on summary', alsoShowOnSummary(p, P), 'Your profile');

// ── schemas and samples through the bone's state (computeIssues) ─────────────

function issueIds(schema: FormKindSchema, a: Answers, ctx: FormContext): string[] {
  return computeIssues(schema, a, ctx).map((i) => `${i.severity}:${i.ruleId}`);
}

eq('post sample is ready', issueIds(postKind, POST_SAMPLE, P), []);
eq('meeting sample is ready', issueIds(meetingKind, MEETING_SAMPLE, G), []);
eq('meeting repeat sample is ready', issueIds(meetingKind, MEETING_REPEAT_SAMPLE, G), []);
eq('meeting 1h sample: two blocks, one warning', issueIds(meetingKind, MEETING_ERRORS_SAMPLE, G), [
  'block:meeting.past',
  'block:meeting.link-empty',
  'warn:meeting.min-over-cap',
]);
eq('blank meeting asks for title, date, time and place', issueIds(meetingKind, meetingKind.empty(G), G), [
  'block:meeting.title',
  'block:meeting.date',
  'block:meeting.time',
  'block:meeting.where',
]);
eq('blank post asks for a title', issueIds(postKind, postKind.empty(P), P), ['block:post.title']);
// Emails hidden where no reminder tick runs: its rule must not fire either.
eq(
  'reminder rule silent where the org cannot remind',
  issueIds(meetingKind, { ...MEETING_SAMPLE, reminder_minutes_before: 4 }, { ...G, fields: { ...G.fields, canRemind: false } }),
  []
);
eq('labels', [postKind.label(p), meetingKind.label(g), meetingKind.label(MEETING_REPEAT_SAMPLE)], ['New post', 'New meeting', 'New meeting']);
eq('codeKind', meetingKind.codeKind(MEETING_REPEAT_SAMPLE), 'meeting');
eq('defaultOpen', [postKind.defaultOpen(p), meetingKind.defaultOpen(g)], [['alsoOn'], ['rsvp']]);
eq('autosave while Repeats is on (no series choice to lose since 2026-11-14)', meetingKind.autosave?.(MEETING_REPEAT_SAMPLE) ?? true, true);
eq('a repeating meeting draws no series sections', visibleSections(meetingKind, MEETING_REPEAT_SAMPLE, G).map((s) => s.id).filter((id) => id === 'sessions' || id === 'seriesPage'), []);

for (const schema of [postKind, meetingKind] as FormKindSchema[]) {
  const ids = schema.sections.map((s) => s.id);
  eq(`${schema.id}: section ids unique`, new Set(ids).size, ids.length);
  for (const r of schema.rules) eq(`${schema.id}: rule ${r.id} points at a section`, ids.includes(r.section), true);
  for (const s of schema.sections) if (s.render) eq(`${schema.id}: ${s.id} render "${s.render}" has a component`, Boolean(schema.components?.[s.render]), true);
  for (const d of schema.deferred ?? []) {
    eq(`${schema.id}: deferred ${d.id} is not drawn`, ids.includes(d.id), false);
    eq(`${schema.id}: deferred ${d.id} cites code or the plan`, /:\d|PLAN|DEBRIEF/.test(d.reason), true);
  }
  for (const id of schema.defaultOpen(schema.empty(schema.id === 'post' ? P : G))) eq(`${schema.id}: default-open ${id} exists`, ids.includes(id), true);
}

// ── pass 2: Artwork and Offering (rules/check-kinds.ts) ──────────────────────

eq('rulesFor every kind', [rulesFor('post'), rulesFor('meeting'), rulesFor('artwork'), rulesFor('service')].map((r) => r.length > 0), [true, true, true, true]);
checkKinds({ eq, cases });

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
