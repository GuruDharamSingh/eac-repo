// ============================================================================
// Series (2026-11-14): its own form kind, made here and edited in its planner
// (docs/open/STUDIO_FORMS_SPLIT_2026-11-14.md §7, reversing PLAN §3 "derived,
// never chosen"). It asks only what the planner's create stores: the name, the
// Why line, and how it meets (every 1–4 weeks, or on chosen dates). Hosts,
// session titles, places, the page and its audience are set in the planner,
// which the form opens after the save (adapters/series-create.ts).
// ============================================================================

import { knownTimeZone } from '@elkdonis/cms-ui/compose';
import type { Answers, FormContext, FormKindSchema, SectionProps } from '../../contract';
import { SERIES_KIND_RULES } from '../../rules/series-kind';
import { SeriesWhen } from './When';

function SeriesWhy({ field }: SectionProps) {
  return field('excerpt', { input: 'text', label: 'Why', hideLabel: true, placeholder: 'What the series is, in one line', hint: '' });
}

export function emptySeriesAnswers(ctx: FormContext): Answers {
  return {
    kind: 'series',
    title: '',
    excerpt: '',
    series_mode: 'weekly',
    duration_minutes: 60,
    series_every_weeks: 1,
    series_dates: [],
    time_zone: knownTimeZone(ctx.timeZone) ?? ctx.timeZone,
  };
}

export const seriesKind: FormKindSchema = {
  id: 'series',
  label: () => 'New series',
  codeKind: () => 'series',
  // Its fields are drawn with explicit overrides, not from a content-fields list.
  specKind: () => null,
  // Made once, on Save or Publish; never autosaved (a draft would be a real series).
  autosave: () => false,
  // The planner's create makes a published, unlisted series: there is no draft to save.
  drafts: false,
  sections: [
    { id: 'title', label: 'Title', tier: 'essentials', fields: ['title'], quick: true },
    { id: 'why', label: 'Why', tier: 'essentials', fields: ['excerpt'], render: 'seriesWhy', quick: true },
    { id: 'when', label: 'When', tier: 'essentials', fields: ['series_mode', 'scheduled_at', 'start_time', 'duration_minutes', 'series_dates'], render: 'seriesWhen', quick: true },
  ],
  components: { seriesWhy: SeriesWhy, seriesWhen: SeriesWhen },
  rules: SERIES_KIND_RULES,
  defaultOpen: () => [],
  empty: emptySeriesAnswers,
};
