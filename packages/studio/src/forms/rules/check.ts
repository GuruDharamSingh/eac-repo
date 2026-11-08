// ============================================================================
// Unit check for the forms' rules, readers and kind schemas (soft tissue).
// Pure: no DOM, no data. Run inside the admin container:
//
//   ssh eris 'cd ~/eac && sudo -n docker compose run --rm --no-deps -w /app/packages/studio admin \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs src/forms/rules/check.ts'
//
// Exits 1 on the first failed group's end, printing every failure.
// ============================================================================

import type { Answers, FormContext, FormKindSchema, FormRule } from '../contract';
import { computeIssues } from '../state';
import { postKind, POST_SAMPLE, POST_SAMPLE_CONTEXT } from '../kinds/post';
import { alsoShowOnSummary, excerptSummary } from '../kinds/post/sections';
import {
  gatheringKind,
  GATHERING_ERRORS_SAMPLE,
  GATHERING_REPEAT_SAMPLE,
  GATHERING_SAMPLE,
  GATHERING_SAMPLE_CONTEXT,
  emailsSummary,
  hostsSummary,
  publishingSummary,
  rsvpSummary,
  whenHint,
} from '../kinds/gathering';
import {
  durationLabel,
  endTime,
  repeatSummary,
  sessionCount,
  startHasPassed,
  untilForCount,
  zoneLabel,
} from './answers';
import { GATHERING_RULES } from './gathering';
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

const G = GATHERING_SAMPLE_CONTEXT;
const g = GATHERING_SAMPLE;

// ── gathering rules ──────────────────────────────────────────────────────────

cases(GATHERING_RULES, 'gathering.title', G, g, [
  ['empty', { title: '' }, true],
  ['one letter', { title: 'A' }, true],
  ['spaces', { title: '   ' }, true],
  ['a title', { title: 'Open studio' }, false],
]);

cases(GATHERING_RULES, 'gathering.date', G, g, [
  ['no date', { scheduled_at: '' }, true],
  ['date only', { scheduled_at: '2026-11-19' }, false],
  ['date and time', { scheduled_at: '2026-11-19T18:30' }, false],
]);

cases(GATHERING_RULES, 'gathering.time', G, g, [
  ['date only, no preset time', { scheduled_at: '2026-11-19', start_time: undefined }, true],
  ['date only, preset start_time', { scheduled_at: '2026-11-19', start_time: '18:30' }, false],
  ['wall clock', { scheduled_at: '2026-11-19T18:30', start_time: undefined }, false],
  ['nothing at all', { scheduled_at: '', start_time: undefined }, true],
]);

// now = 2026-11-10 12:04 in Toronto
cases(GATHERING_RULES, 'gathering.past', G, g, [
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
eq('startHasPassed reads the gathering’s own zone', startHasPassed({ scheduled_at: '2026-11-10T17:30', time_zone: 'Europe/Paris' }, G), true);
eq('startHasPassed, same wall clock in Toronto is still to come', startHasPassed({ scheduled_at: '2026-11-10T17:30', time_zone: 'America/Toronto' }, G), false);

cases(GATHERING_RULES, 'gathering.duration', G, g, [
  ['2h', { duration_minutes: 120 }, false],
  ['4 min', { duration_minutes: 4 }, true],
  ['25 h', { duration_minutes: 1500 }, true],
  ['empty', { duration_minutes: '' }, false],
  ['as a string', { duration_minutes: '45' }, false],
]);

cases(GATHERING_RULES, 'gathering.until', G, g, [
  ['weekly, until a week before', { recurrence_pattern: 'WEEKLY', recurrence_until: '2026-11-12T23:59' }, true],
  ['weekly, until the start day 23:59', { recurrence_pattern: 'WEEKLY', recurrence_until: '2026-11-19T23:59' }, false],
  ['weekly, until a bare date before', { recurrence_pattern: 'WEEKLY', recurrence_until: '2026-11-19' }, true],
  ['not repeating', { recurrence_pattern: 'NONE', recurrence_until: '2026-11-01' }, false],
]);

cases(GATHERING_RULES, 'gathering.where', G, g, [
  ['place, no address', { where_mode: 'place', location: '' }, true],
  ['place, an address', { where_mode: 'place', location: 'Studio 4' }, false],
  ['link mode', { where_mode: 'link', location: '' }, false],
  ['talk mode', { where_mode: 'talk', location: '' }, false],
  ['no where_mode, in person, empty (derived place)', { where_mode: undefined, format: 'in_person', location: '' }, true],
  ['no where_mode, online + Talk room preset', { where_mode: undefined, format: 'online', create_talk_room: true, location: '' }, false],
]);

cases(GATHERING_RULES, 'gathering.link-empty', G, g, [
  ['link, empty', { where_mode: 'link', meeting_url: '' }, true],
  ['link, spaces', { where_mode: 'link', meeting_url: '  ' }, true],
  ['link, a URL', { where_mode: 'link', meeting_url: 'https://meet.jit.si/elkdonis-open-studio' }, false],
  ['talk', { where_mode: 'talk', meeting_url: '' }, false],
  ['place without also-online', { where_mode: 'place', meeting_url: '' }, false],
]);

cases(GATHERING_RULES, 'gathering.link-invalid', G, g, [
  ['link, no scheme', { where_mode: 'link', meeting_url: 'meet.jit.si/x' }, true],
  ['link, https', { where_mode: 'link', meeting_url: 'https://meet.jit.si/x' }, false],
  ['place + also online, ftp', { where_mode: 'place', meeting_url: 'ftp://x.org' }, true],
  ['talk ignores the link', { where_mode: 'talk', meeting_url: 'junk' }, false],
  ['empty is the other rule', { where_mode: 'link', meeting_url: '' }, false],
]);

cases(GATHERING_RULES, 'gathering.reminder-range', G, g, [
  ['never asked', { reminder_minutes_before: undefined }, false],
  ['off', { reminder_minutes_before: null }, false],
  ['a day', { reminder_minutes_before: 1440 }, false],
  ['4 minutes', { reminder_minutes_before: 4 }, true],
  ['two weeks', { reminder_minutes_before: 20160 }, false],
  ['two weeks and a minute', { reminder_minutes_before: 20161 }, true],
  ['not whole', { reminder_minutes_before: 90.5 }, true],
]);

cases(GATHERING_RULES, 'gathering.recording-invalid', G, g, [
  ['none', { video_link: '' }, false],
  ['https', { video_link: 'https://vimeo.com/1' }, false],
  ['no scheme', { video_link: 'vimeo.com/1' }, true],
]);

cases(GATHERING_RULES, 'gathering.min-over-cap', G, g, [
  ['12 over 10', { min_attendees: 12, attendee_limit: 10 }, true],
  ['6 under 24', { min_attendees: 6, attendee_limit: 24 }, false],
  ['12, no cap', { min_attendees: 12, attendee_limit: undefined }, false],
  ['RSVPs off', { min_attendees: 12, attendee_limit: 10, is_rsvp_enabled: false }, false],
  ['strings from inputs', { min_attendees: '12', attendee_limit: '10' }, true],
]);

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
eq('repeat sample carries the 8th Thursday', GATHERING_REPEAT_SAMPLE.recurrence_until, '2027-01-07T23:59');
eq('untilForCount: 3 monthly (third Thursday)', untilForCount({ ...g, recurrence_pattern: 'MONTHLY' }, G, 3), '2027-01-21T23:59');
eq('sessionCount derived back from a bare until', sessionCount({ ...g, recurrence_pattern: 'WEEKLY', recurrence_until: '2027-01-07' }, G), 8);
eq('sessionCount from forms.repeat_count', sessionCount(GATHERING_REPEAT_SAMPLE, G), 8);
eq('repeatSummary weekly', repeatSummary(GATHERING_REPEAT_SAMPLE, G), 'Every week on Thursday, 8 sessions');
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
eq('rsvp summary, warning', rsvpSummary(GATHERING_ERRORS_SAMPLE), 'Needs 12 to go ahead, but only 10 places');
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
eq('gathering sample is ready', issueIds(gatheringKind, GATHERING_SAMPLE, G), []);
eq('gathering repeat sample is ready', issueIds(gatheringKind, GATHERING_REPEAT_SAMPLE, G), []);
eq('gathering 1h sample: two blocks, one warning', issueIds(gatheringKind, GATHERING_ERRORS_SAMPLE, G), [
  'block:gathering.past',
  'block:gathering.link-empty',
  'warn:gathering.min-over-cap',
]);
eq('blank gathering asks for title, date, time and place', issueIds(gatheringKind, gatheringKind.empty(G), G), [
  'block:gathering.title',
  'block:gathering.date',
  'block:gathering.time',
  'block:gathering.where',
]);
eq('blank post asks for a title', issueIds(postKind, postKind.empty(P), P), ['block:post.title']);
// Emails hidden where no reminder tick runs: its rule must not fire either.
eq(
  'reminder rule silent where the org cannot remind',
  issueIds(gatheringKind, { ...GATHERING_SAMPLE, reminder_minutes_before: 4 }, { ...G, fields: { ...G.fields, canRemind: false } }),
  []
);
eq('labels', [postKind.label(p), gatheringKind.label(g), gatheringKind.label({ ...GATHERING_REPEAT_SAMPLE, 'forms.repeat_as_series': true })], ['New post', 'New gathering', 'New series']);
eq('codeKind', [gatheringKind.codeKind(GATHERING_REPEAT_SAMPLE), gatheringKind.codeKind({ ...GATHERING_REPEAT_SAMPLE, 'forms.repeat_as_series': true })], ['meeting', 'series']);
eq('defaultOpen', [postKind.defaultOpen(p), gatheringKind.defaultOpen(g)], [['alsoOn'], ['rsvp']]);

for (const schema of [postKind, gatheringKind] as FormKindSchema[]) {
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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
