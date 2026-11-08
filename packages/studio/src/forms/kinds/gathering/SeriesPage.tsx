'use client';

// ============================================================================
// Gathering → Series page (More row, series only; soft tissue, pass 2).
// Design: README §4 "Series page" ("Listed on Series · colour picked for you";
// collapsed by default).
//
// forms.series_page { listed, slides, featured } → on Publish only (a draft
// keeps them in metadata.forms; adapters/series.ts):
//   listed    metadata.series.listed   (SaveSeriesSettingsInput, meeting-series.ts:1050)
//   slides    metadata.series.landing  (:1052)
//   featured  saveSeriesPageSettings featuredId (series-page.ts:76): one per org,
//             so it REPLACES the featured series (series-page.ts:95-105)
// The colour is the Series page's own pick by position (series-page.ts:154);
// the form offers no colour, so the summary says it is picked.
// ============================================================================

import * as React from 'react';
import type { SectionProps } from '../../contract';
import { seriesPageOf, type SeriesPageChoice } from '../../rules/series';
import { Hint, Stack } from '../post/parts';

export function SeriesPage({ answers: a, patch, field }: SectionProps) {
  const p = seriesPageOf(a);
  const set = (k: keyof SeriesPageChoice, v: unknown) => patch({ 'forms.series_page': { ...p, [k]: v === true } });
  return (
    <Stack gap={12}>
      {field('forms.series_page.listed', {
        input: 'boolean',
        label: 'Listed on the Series page',
        value: p.listed,
        onChange: (v) => set('listed', v),
      })}
      {field('forms.series_page.slides', {
        input: 'boolean',
        label: 'In the landing page slides',
        value: p.slides,
        onChange: (v) => set('slides', v),
      })}
      {field('forms.series_page.featured', {
        input: 'boolean',
        label: 'Featured, first on Series and the landing page',
        hint: 'One series is featured at a time, so this replaces the one featured now.',
        value: p.featured,
        onChange: (v) => set('featured', v),
      })}
      <Hint>These apply when you publish.</Hint>
    </Stack>
  );
}
