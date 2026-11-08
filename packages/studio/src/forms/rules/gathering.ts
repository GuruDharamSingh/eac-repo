// ============================================================================
// Gathering rules (code kind `meeting`), with the README §7 copy.
//
// The client runs these; the server still parses and stays the authority
// (meeting-content.ts validate()). Each blocking rule here either is one the
// design asks for or mirrors a refusal the save would give anyway, so the
// person hears it under the field instead of as a failed save.
//
//   design   title, date, time, where, a past start, an empty online link (block);
//            "Needs at least" above "Places" (warn)
//   mirrors  meeting-content.ts validate(): a title of two letters or more, until
//            after the start, 5 min to 24 h, http(s) joining and recording links,
//            the reminder at 5 min to two weeks (:333-334)
//
// Sections and fields are the gathering schema's (kinds/gathering/schema.ts):
// the time control is `start_time`, joined to scheduled_at by the When section
// and by the adapter (forms/adapters/gathering.ts).
//
// Series in place (pass 2): the rules above hold for a series too, except the
// length (a series session is 15 min to 10 h) and the minimum (a series week
// carries no minimum). The series rules mirror what the series save refuses:
//   series.weekly        WEEKLY only (adapters/series.ts; SeriesScheduleInput.monthly, meeting-series.ts:1918)
//   series.duration      saveSeriesSchedule: 15 min to 10 h (meeting-series.ts:1995)
//   series.sessions-none at least one session that is not skipped (design §7, the brief)
// A series may be members-only: series honour the thread audience since cc440377
// (canReadSeriesRow, meeting-series.ts:617-625), so there is no visibility rule.
// ============================================================================

import type { FormRule } from '../contract';
import { whereModeOf } from '../adapters/gathering';
import {
  datePart,
  isHttpUrl,
  isRepeating,
  isSeries,
  num,
  repeatPattern,
  startHasPassed,
  startInstant,
  startTime,
  text,
  trimmed,
  untilInstant,
} from './answers';
import { seriesSessions } from './series';

export const GATHERING_RULES: FormRule[] = [
  {
    id: 'gathering.title',
    severity: 'block',
    fields: ['title'],
    section: 'title',
    test: (a) => trimmed(a.title).length < 2,
    message: 'Give it a title.',
    short: 'Title: missing',
  },
  {
    id: 'gathering.date',
    severity: 'block',
    fields: ['scheduled_at'],
    section: 'when',
    test: (a) => !datePart(a.scheduled_at),
    message: 'Pick the day it happens.',
    short: 'When: no date',
  },
  {
    id: 'gathering.time',
    severity: 'block',
    fields: ['start_time'],
    section: 'when',
    test: (a) => !startTime(a),
    message: 'Pick the time it starts.',
    short: 'When: no start time',
  },
  {
    // A saved gathering keeps its stored start (forms.loaded_start, set on load):
    // editing a past one-off to add its recording, or a standing meeting whose
    // first date is years old, is not "a date in the past". A new date is.
    id: 'gathering.past',
    severity: 'block',
    fields: ['scheduled_at'],
    section: 'when',
    test: (a, ctx) => {
      if (!startHasPassed(a, ctx)) return false;
      const loaded = text(a['forms.loaded_start']);
      return !loaded || loaded !== text(a.scheduled_at);
    },
    message: 'This date has passed. Pick a day from today on.',
    short: 'When: the date has passed',
  },
  {
    id: 'gathering.duration',
    severity: 'block',
    fields: ['duration_minutes'],
    section: 'when',
    test: (a) => {
      if (isSeries(a)) return false; // series.duration
      const d = num(a.duration_minutes);
      return d !== null && (d < 5 || d > 24 * 60);
    },
    message: 'Make it between 5 minutes and 24 hours.',
    short: 'When: the length',
  },
  {
    id: 'series.duration',
    severity: 'block',
    fields: ['duration_minutes'],
    section: 'when',
    test: (a) => {
      if (!isSeries(a)) return false;
      const d = num(a.duration_minutes);
      return d !== null && (d < 15 || d > 600);
    },
    message: 'A session lasts between 15 minutes and 10 hours.',
    short: 'When: the length of a session',
  },
  {
    id: 'series.weekly',
    severity: 'block',
    fields: ['recurrence_pattern'],
    section: 'when',
    test: (a) => isSeries(a) && repeatPattern(a) !== 'WEEKLY',
    message: 'A series meets every one to four weeks. Pick how often under Repeats.',
    short: 'When: a series repeats by the week',
  },
  {
    id: 'series.sessions-none',
    severity: 'block',
    fields: ['forms.sessions'],
    section: 'sessions',
    test: (a) => {
      if (!isSeries(a)) return false;
      const rows = seriesSessions(a);
      return rows.length > 0 && rows.every((r) => r.skipped);
    },
    message: 'Every date is skipped. Put one back, or add a session.',
    short: 'Sessions: every date is skipped',
  },
  {
    id: 'gathering.until',
    severity: 'block',
    fields: ['recurrence_until'],
    section: 'when',
    test: (a, ctx) => {
      if (!isRepeating(a)) return false;
      const until = untilInstant(a, ctx);
      const start = startInstant(a, ctx);
      return Boolean(until && start && until.getTime() <= start.getTime());
    },
    message: 'It stops repeating before it starts. Pick a later last date.',
    short: 'When: stops before it starts',
  },
  {
    id: 'gathering.where',
    severity: 'block',
    fields: ['location'],
    section: 'where',
    test: (a) => whereModeOf(a) === 'place' && !trimmed(a.location),
    message: 'Add the place, or choose Online link or Talk room.',
    short: 'Where: no place',
  },
  {
    id: 'gathering.link-empty',
    severity: 'block',
    fields: ['meeting_url'],
    section: 'where',
    test: (a) => whereModeOf(a) === 'link' && !trimmed(a.meeting_url),
    message: 'Add the joining link, or switch to a Talk room.',
    short: 'Where: no joining link',
  },
  {
    id: 'gathering.link-invalid',
    severity: 'block',
    fields: ['meeting_url'],
    section: 'where',
    test: (a) => whereModeOf(a) !== 'talk' && trimmed(a.meeting_url) !== '' && !isHttpUrl(a.meeting_url),
    message: 'Paste the whole link, starting with https://.',
    short: 'Where: the link is incomplete',
  },
  {
    // meeting-content.ts:333-334: whole minutes, 5 to two weeks. Null is off; undefined was never asked.
    id: 'gathering.reminder-range',
    severity: 'block',
    fields: ['reminder_minutes_before'],
    section: 'emails',
    test: (a) => {
      const r = a.reminder_minutes_before;
      if (r === undefined || r === null || r === '') return false;
      const n = num(r);
      return n === null || !Number.isInteger(n) || n < 5 || n > 14 * 24 * 60;
    },
    message: 'Send the reminder between 5 minutes and two weeks before.',
    short: 'Emails: the reminder time',
  },
  {
    id: 'gathering.recording-invalid',
    severity: 'block',
    fields: ['video_link'],
    section: 'materials',
    test: (a) => trimmed(a.video_link) !== '' && !isHttpUrl(a.video_link),
    message: 'Paste the whole link, starting with https://.',
    short: 'Materials: the recording link is incomplete',
  },
  {
    id: 'gathering.min-over-cap',
    severity: 'warn',
    fields: ['min_attendees', 'attendee_limit'],
    section: 'rsvp',
    test: (a) => {
      // A series week carries no minimum (meeting-series.ts:1333-1347); the series form draws none.
      if (a.is_rsvp_enabled === false || isSeries(a)) return false;
      const min = num(a.min_attendees);
      const cap = num(a.attendee_limit);
      return min !== null && cap !== null && min > cap;
    },
    message: 'It needs more people to go ahead than it has places.',
    short: 'Places and RSVP: needs more than it has places',
  },
];
