'use client';

// ============================================================================
// Series → When (2026-11-14). Two ways a series meets, as the planner offers them:
//
//   [● Every week]  [  On chosen dates]
//   weekly:  [first date] [time]  [1h ▾]   Every [week ▾]   Last date [   ]
//   dates:   [date and time] ×   [date and time] ×   + Add a date      [1h ▾]
//
// Keys: series_mode ('weekly' | 'dates'), scheduled_at (the first date), start_time,
// duration_minutes, series_every_weeks (1–4), recurrence_until (the last date),
// series_dates (local "YYYY-MM-DDTHH:MM" strings), time_zone. The planner's create
// takes them as they are (adapters/series-create.ts).
// ============================================================================

import * as React from 'react';
import type { SectionProps } from '../../contract';
import { seriesDatesOf, seriesModeOf } from '../../adapters/series-create';
import { datePart, joinStart, num, startTime, text } from '../../rules/answers';
import { Cell, Row, Stack, TextAction, Words } from '../post/parts';

const LENGTHS = [30, 45, 60, 90, 120, 180].map((m) => ({ value: String(m), label: m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}` : `${m / 60}h` }));
const EVERY = [1, 2, 3, 4].map((n) => ({ value: String(n), label: n === 1 ? 'week' : `${n} weeks` }));

export function SeriesWhen({ answers: a, patch, field }: SectionProps) {
  const mode = seriesModeOf(a);
  const dates = seriesDatesOf(a);
  const setDate = (i: number, v: string) => patch({ series_dates: dates.map((d, k) => (k === i ? v : d)) });
  const removeDate = (i: number) => patch({ series_dates: dates.filter((_, k) => k !== i) });

  const length = field('duration_minutes', {
    input: 'select',
    label: 'How long',
    hideLabel: true,
    options: LENGTHS,
    value: String(num(a.duration_minutes) ?? 60),
    onChange: (v) => patch({ duration_minutes: Number(v) || 60 }),
  });

  return (
    <Stack gap={10}>
      {field('series_mode', {
        input: 'radio',
        label: 'How it meets',
        hideLabel: true,
        options: [
          { value: 'weekly', label: 'Every week' },
          { value: 'dates', label: 'On chosen dates' },
        ],
        value: mode,
        onChange: (v) => patch({ series_mode: v === 'dates' ? 'dates' : 'weekly', ...(v === 'dates' && !dates.length ? { series_dates: [''] } : {}) }),
      })}

      {mode === 'weekly' ? (
        <>
          <Row name="series-start" align="center">
            <Cell flex="1 1 12em">
              {field('scheduled_at', {
                input: 'date',
                label: 'First session',
                hideLabel: true,
                required: true,
                value: datePart(a.scheduled_at),
                onChange: (v) => patch({ scheduled_at: joinStart(text(v), startTime(a)) }),
              })}
            </Cell>
            <Cell flex="0 0 9.5em">
              {field('start_time', {
                input: 'time',
                label: 'Starts',
                hideLabel: true,
                required: true,
                value: startTime(a),
                onChange: (v) => patch({ start_time: text(v) || undefined, scheduled_at: joinStart(datePart(a.scheduled_at), text(v)) }),
              })}
            </Cell>
            <Cell flex="0 0 7.5em">{length}</Cell>
          </Row>
          <Row name="series-every" gap={8} align="center">
            <Words>Every</Words>
            <Cell flex="0 0 auto">
              {field('series_every_weeks', {
                input: 'select',
                label: 'Every',
                hideLabel: true,
                options: EVERY,
                value: String(num(a.series_every_weeks) ?? 1),
                onChange: (v) => patch({ series_every_weeks: Number(v) || 1 }),
              })}
            </Cell>
            <Words>until</Words>
            <Cell flex="0 1 11em">
              {field('recurrence_until', {
                input: 'date',
                label: 'Last date',
                hideLabel: true,
                placeholder: 'No end',
                value: datePart(a.recurrence_until),
                onChange: (v) => patch({ recurrence_until: text(v) }),
              })}
            </Cell>
          </Row>
        </>
      ) : (
        <>
          {dates.map((d, i) => (
            <Row key={i} name="series-date" gap={8} align="center">
              <Cell flex="1 1 16em">
                {field(`series_dates.${i}`, {
                  input: 'datetime',
                  label: `Date ${i + 1}`,
                  hideLabel: true,
                  value: d,
                  onChange: (v) => setDate(i, text(v)),
                })}
              </Cell>
              {dates.length > 1 && <TextAction onClick={() => removeDate(i)}>Remove</TextAction>}
            </Row>
          ))}
          <Row name="series-dates-more" gap={8} align="center">
            {dates.length < 60 && <TextAction onClick={() => patch({ series_dates: [...dates, ''] })}>+ Add a date</TextAction>}
            <Cell flex="0 0 7.5em">{length}</Cell>
          </Row>
        </>
      )}
    </Stack>
  );
}
