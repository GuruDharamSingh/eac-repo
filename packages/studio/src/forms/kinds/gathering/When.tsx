'use client';

// ============================================================================
// Gathering → When (soft tissue). Design: README §4 "When", Publish Form 1b/1c.
//
//   [date] [time] [1h | 1½h | 2h | 3h | Other]
//   Ends 20:30 · Eastern time (Toronto) · Change
//   (Repeats)  Every week on Thursday, 8 sessions
//      Every [week ▾] on Thursdays   [8 sessions | Until a date]
//      [✓] Present it as a series
//
// Every control is the shell's, through field(). The answer keys underneath
// are content-fields' meeting keys:
//   scheduled_at        "YYYY-MM-DD" while there is no time yet, then "YYYY-MM-DDTHH:mm"
//   start_time          the time control (also a preset key; the adapter joins it
//                       to a date-only scheduled_at)
//   duration_minutes    set by the seg (virtual `duration_choice`); Other opens a minutes input on the key itself
//   time_zone           behind "Change"
//   recurrence_pattern  'NONE' | DAILY | WEEKLY | MONTHLY: the Repeats switch and "Every"
//   recurrence_until    "N sessions" or "Until a date", stored as that day at 23:59 so
//                       its own session is inside the bound
//   forms.repeat_count  the N (derived back from recurrence_until on load; the adapter
//                       drops it, DERIVED_FORM_KEYS)
//
// Series in place (pass 2, PLAN §12): "Present it as a series" sets
// forms.repeat_as_series (rules/answers.ts isSeries → codeKind 'series', "New
// series"). It is drawn only on a WEEKLY repeat (a series is weekly, every 1–4
// weeks: meeting-series.ts:95, :1918) and only before the form has a record
// (SectionProps.recordId): a saved gathering is a meeting, and an existing
// series is edited in its planner. As a series:
//   "Every" offers 1–4 weeks (forms.repeat_every_weeks), the weekday derived
//   from the first date; "N sessions" counts sessions HELD, so the planner's
//   skips push the last date out (rules/series.ts withSeriesSchedule); every
//   schedule edit rebuilds forms.sessions by date.
// Turning Repeats off unticks it too, so a meeting saved in between can never
// come back as a series.
// ============================================================================

import * as React from 'react';
import type { Answers, SectionProps } from '../../contract';
import {
  datePart,
  dayLabel,
  durationLabel,
  endTime,
  isRepeating,
  isSeries,
  joinStart,
  num,
  repeatPattern,
  repeatSummary,
  sessionCount,
  startTime,
  text,
  untilForCount,
  untilForDate,
  weekdayOf,
  zoneLabel,
  zoneOf,
} from '../../rules/answers';
import { SERIES_EVERY_WEEKS, canBeSeries, seriesEnds, seriesEveryWeeks, seriesHeldCount, seriesRepeatSummary, withSeriesSchedule } from '../../rules/series';
import { Cell, Hint, Row, Stack, TextAction, Words } from '../post/parts';

/** The design's seg: 1h | 1½h | 2h | 3h, then Other. */
export const DURATION_CHOICES = [60, 90, 120, 180];

const PATTERN_OPTIONS = [
  { value: 'DAILY', label: 'day' },
  { value: 'WEEKLY', label: 'week' },
  { value: 'MONTHLY', label: 'month' },
];

const EVERY_WEEKS_OPTIONS = SERIES_EVERY_WEEKS.map((n) => ({ value: String(n), label: n === 1 ? 'week' : `${n} weeks` }));

const ORDINAL = ['first', 'second', 'third', 'fourth', 'last'];

/** "on Thursdays" | "on the third Thursday" | "" (daily), from the start date. */
export function cadenceWords(a: Answers): string {
  const pattern = repeatPattern(a);
  const date = datePart(a.scheduled_at);
  if (!pattern || pattern === 'DAILY') return '';
  if (!date) return 'on the day you pick';
  const day = weekdayOf(date);
  if (pattern === 'WEEKLY') return `on ${day}s`;
  const d = Number(date.slice(8, 10));
  return `on the ${ORDINAL[Math.min(4, Math.ceil(d / 7) - 1)]} ${day}`;
}

/** "Ends 20:30 · Eastern time (Toronto)". */
export function whenHint(a: Answers, zone: string): string {
  const end = endTime(startTime(a), num(a.duration_minutes));
  return [end ? `Ends ${end}` : '', zoneLabel(zone)].filter(Boolean).join(' · ');
}

/** The Repeats switch's line: a series counts held sessions and says "every 2 weeks". */
export function whenRepeatSummary(a: Answers, ctx: Parameters<typeof repeatSummary>[1]): string {
  return isSeries(a) ? seriesRepeatSummary(a) : repeatSummary(a, ctx);
}

export function GatheringWhen({ answers: a, patch, ctx, field, tier, recordId }: SectionProps) {
  const date = datePart(a.scheduled_at);
  const time = startTime(a);
  const zone = zoneOf(a, ctx);
  const duration = num(a.duration_minutes);
  const repeating = isRepeating(a);
  const series = isSeries(a);
  const quick = tier === 'quick';

  const [zoneOpen, setZoneOpen] = React.useState(false);
  const [otherLength, setOtherLength] = React.useState(duration !== null && !DURATION_CHOICES.includes(duration));
  // How the repeat ends. A loaded gathering has recurrence_until only, so "N sessions"
  // is derived back from it; with no start to count from, it reads as a date.
  const [ends, setEnds] = React.useState<'count' | 'until'>(() =>
    num(a['forms.repeat_count']) === null && datePart(a.recurrence_until) && sessionCount(a, ctx) === null ? 'until' : 'count'
  );
  const count = num(a['forms.repeat_count']) ?? (series ? (seriesEnds(a) === 'until' ? seriesHeldCount(a) : null) : sessionCount(a, ctx));

  /** recurrence_until for "N sessions": a series counts held dates (skips push it out). */
  const untilFor = (next: Answers, n: number) => (isSeries(next) ? '' : untilForCount(next, ctx, n));

  /**
   * Patch, keeping "N sessions" true: when the start, the time or the pattern moves,
   * the last session's date moves with it. A series also rebuilds its session list.
   */
  const apply = (fields: Partial<Answers>) => {
    const next = { ...a, ...fields };
    if (isRepeating(next) && ends === 'count') {
      const n = num(next['forms.repeat_count']) ?? count;
      if (n !== null && n > 0) {
        fields = isSeries(next) ? { ...fields, 'forms.repeat_count': n } : { ...fields, 'forms.repeat_count': n, recurrence_until: untilFor(next, n) };
      }
    }
    patch(withSeriesSchedule(a, fields));
  };

  /** "Present it as a series" on or off. */
  const setSeries = (on: boolean) => {
    if (on) return patch(withSeriesSchedule(a, { 'forms.repeat_as_series': true, recurrence_pattern: 'WEEKLY' }));
    // Back to a meeting: it repeats weekly with no interval, so "N sessions" is recounted that way.
    const fields: Partial<Answers> = { 'forms.repeat_as_series': false };
    const n = num(a['forms.repeat_count']);
    if (ends === 'count' && n !== null && n > 0) fields.recurrence_until = untilForCount({ ...a, ...fields }, ctx, n);
    patch(fields);
  };

  const lengthChoices = [
    ...DURATION_CHOICES.map((m) => ({ value: String(m), label: durationLabel(m) })),
    { value: 'other', label: 'Other' },
  ];

  return (
    <Stack gap={10}>
      <Row name="when-start" align="center">
        <Cell flex="1 1 170px">
          {field('scheduled_at', {
            input: 'date',
            label: series ? 'First session' : 'Date',
            hideLabel: true,
            required: true,
            value: date,
            onChange: (v) => apply({ scheduled_at: joinStart(text(v), time) }),
          })}
        </Cell>
        <Cell flex="0 0 132px">
          {field('start_time', {
            input: 'time',
            label: 'Starts',
            hideLabel: true,
            required: true,
            value: time,
            onChange: (v) => {
              const t = text(v);
              apply({ start_time: t || undefined, scheduled_at: joinStart(date, t) });
            },
          })}
        </Cell>
        <Cell flex="0 1 auto">
          {/* Virtual (its own name, so the ids stay unique): Other opens duration_minutes itself. */}
          {field('duration_choice', {
            input: quick ? 'select' : 'radio',
            label: 'How long',
            hideLabel: true,
            options: lengthChoices,
            value: otherLength ? 'other' : duration !== null ? String(duration) : '',
            onChange: (v) => {
              if (v === 'other') return setOtherLength(true);
              setOtherLength(false);
              apply({ duration_minutes: Number(v) });
            },
          })}
        </Cell>
        {otherLength && (
          <Cell flex="0 0 120px">
            {field('duration_minutes', { input: 'number', label: 'Minutes', min: series ? 15 : 5, max: series ? 600 : 24 * 60, step: 5, placeholder: '45' })}
          </Cell>
        )}
      </Row>

      <Hint>
        {whenHint(a, zone)} · <TextAction onClick={() => setZoneOpen((o) => !o)} pressed={zoneOpen}>Change</TextAction>
      </Hint>
      {zoneOpen && field('time_zone', { label: 'Time zone', hint: 'Times are read in this zone.' })}

      {!quick &&
        field('repeats', {
          input: 'toggle',
          label: 'Repeats',
          // The toggle's inline line: "Does not repeat" / "Every week on Thursday, 8 sessions".
          placeholder: whenRepeatSummary(a, ctx),
          value: repeating,
          onChange: (on) =>
            on
              ? apply({ recurrence_pattern: 'WEEKLY' })
              : patch({ recurrence_pattern: 'NONE', recurrence_until: '', 'forms.repeat_count': undefined, 'forms.repeat_as_series': false }),
        })}

      {!quick && repeating && (
        <Stack gap={14} indent={46}>
          <Row name="when-cadence" gap={8} align="center">
            <Words>Every</Words>
            <Cell flex="0 0 auto">
              {series
                ? field('forms.repeat_every_weeks', {
                    input: 'select',
                    label: 'Every',
                    hideLabel: true,
                    options: EVERY_WEEKS_OPTIONS,
                    value: String(seriesEveryWeeks(a)),
                    onChange: (v) => apply({ 'forms.repeat_every_weeks': Number(v) || 1, recurrence_pattern: 'WEEKLY' }),
                  })
                : field('recurrence_pattern', {
                    input: 'select',
                    label: 'Every',
                    hideLabel: true,
                    options: PATTERN_OPTIONS,
                    value: repeatPattern(a) ?? 'WEEKLY',
                    onChange: (v) => apply({ recurrence_pattern: text(v) }),
                  })}
            </Cell>
            {cadenceWords(a) && <Words>{cadenceWords(a)}</Words>}
            <Cell flex="0 1 auto">
              {field('forms.repeat_ends', {
                input: 'radio',
                label: 'Ends',
                hideLabel: true,
                options: [
                  { value: 'count', label: count ? `${count} ${count === 1 ? 'session' : 'sessions'}` : 'Sessions' },
                  { value: 'until', label: 'Until a date' },
                ],
                value: ends,
                onChange: (v) => {
                  if (v === 'until') {
                    setEnds('until');
                    patch(withSeriesSchedule(a, { 'forms.repeat_count': undefined }));
                  } else {
                    setEnds('count');
                    if (count) patch(withSeriesSchedule(a, series ? { 'forms.repeat_count': count } : { 'forms.repeat_count': count, recurrence_until: untilFor(a, count) }));
                  }
                },
              })}
            </Cell>
          </Row>
          {ends === 'count' ? (
            <Row name="when-count" align="center">
              <Cell flex="0 0 120px">
                {field('forms.repeat_count', {
                  input: 'number',
                  label: 'Sessions',
                  min: 1,
                  max: 200,
                  placeholder: 'No end',
                  value: count ?? '',
                  onChange: (v) => {
                    const n = num(v);
                    if (n === null || n < 1 || !Number.isInteger(n)) return patch(withSeriesSchedule(a, { 'forms.repeat_count': undefined, recurrence_until: '' }));
                    patch(withSeriesSchedule(a, series ? { 'forms.repeat_count': n } : { 'forms.repeat_count': n, recurrence_until: untilFor(a, n) }));
                  },
                })}
              </Cell>
              {count && datePart(a.recurrence_until) ? <Words>{`The last one is ${dayLabel(datePart(a.recurrence_until), { weekday: true })}.`}</Words> : null}
            </Row>
          ) : (
            <Row name="when-until" align="center">
              <Cell flex="0 1 200px">
                {field('recurrence_until', {
                  input: 'date',
                  label: 'Last date',
                  value: datePart(a.recurrence_until),
                  onChange: (v) => patch(withSeriesSchedule(a, { recurrence_until: untilForDate(text(v)), 'forms.repeat_count': undefined })),
                })}
              </Cell>
            </Row>
          )}

          {canBeSeries(a) && recordId == null &&
            field('forms.repeat_as_series', {
              input: 'boolean',
              label: 'Present it as a series',
              strong: true,
              // Series page (series-page.ts listSeriesForPage); the whole run = subscribe
              // (setSeriesSubscription), single evenings = each week's own RSVP (ensureSeriesSession).
              hint: 'It gets a series page that lists its sessions. People can sign up for the whole run or RSVP to single evenings.',
              value: series,
              onChange: (v) => setSeries(v === true),
            })}
          {canBeSeries(a) && recordId != null && <Hint>To make a series, start a new gathering.</Hint>}
        </Stack>
      )}
    </Stack>
  );
}
