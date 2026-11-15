// ============================================================================
// The series kind's rules (2026-11-14): what the planner's create refuses
// (packages/series-site/src/routes/hubNewSeries.ts), caught before it is sent.
// ============================================================================

import type { FormRule } from '../contract';
import { seriesDatesOf, seriesModeOf } from '../adapters/series-create';
import { datePart, num, startTime, trimmed } from './answers';

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export const SERIES_KIND_RULES: FormRule[] = [
  {
    id: 'series.title',
    severity: 'block',
    fields: ['title'],
    section: 'title',
    test: (a) => trimmed(a.title).length < 2,
    message: 'Give the series a name.',
    short: 'Title: missing',
  },
  {
    id: 'series.first',
    severity: 'block',
    fields: ['scheduled_at', 'start_time'],
    section: 'when',
    test: (a) => seriesModeOf(a) === 'weekly' && (!datePart(a.scheduled_at) || !startTime(a)),
    message: 'Pick the date and time of the first session.',
    short: 'When: no first session',
  },
  {
    id: 'series.last-before-first',
    severity: 'block',
    fields: ['recurrence_until'],
    section: 'when',
    test: (a) => seriesModeOf(a) === 'weekly' && Boolean(datePart(a.recurrence_until)) && datePart(a.recurrence_until) < datePart(a.scheduled_at),
    message: 'The last date is before the first session.',
    short: 'When: ends before it starts',
  },
  {
    id: 'series.dates-none',
    severity: 'block',
    fields: ['series_dates'],
    section: 'when',
    test: (a) => seriesModeOf(a) === 'dates' && !seriesDatesOf(a).some((d) => LOCAL.test(d)),
    message: 'Add at least one date and time.',
    short: 'When: no dates',
  },
  {
    id: 'series.dates-incomplete',
    severity: 'block',
    fields: ['series_dates'],
    section: 'when',
    test: (a) => seriesModeOf(a) === 'dates' && seriesDatesOf(a).some((d) => d !== '' && !LOCAL.test(d)),
    message: 'One of the dates has no time. Give each a date and a time, or remove it.',
    short: 'When: a date without a time',
  },
  {
    id: 'series.duration',
    severity: 'block',
    fields: ['duration_minutes'],
    section: 'when',
    test: (a) => {
      const d = num(a.duration_minutes);
      return d !== null && (d < 15 || d > 600);
    },
    message: 'A session lasts between 15 minutes and 10 hours.',
    short: 'When: the length of a session',
  },
];
