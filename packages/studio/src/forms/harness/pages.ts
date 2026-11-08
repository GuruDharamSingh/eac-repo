// ============================================================================
// The harness pages, one per canvas id in "Publishing Forms.dc.html":
//   pass 1: 1a, 2a, 2b, 1b, 1h, 1i, 1j, 1l, 1m, 1n, plus `blank` (a fresh
//           gathering: the readiness line must say "Four things left before it
//           can go out.")
//   pass 2: 1c (series with the planner), 1f (artwork), `service` (an offering),
//           1o, 1p and `service-m` (phones), and `1c-page`, `1f-page`,
//           `service-page` (the preview's Page view). 1d/1e (the planner
//           alternates) are pass 4.
// Each is drawn in three looks by scripts/forms-harness: Broadsheet, plain (no
// theme, so every --frm-* falls back), and a dark site's themeVars. Sample data
// is soft tissue's (kinds/*/sample.ts) where it has landed, else the harness
// fixtures (fixtures.tsx); nothing is saved.
// ============================================================================

import type { Answers, FormContext, FormKindId, FormKindSchema, FormLayout, FormPreset, FormUiState } from '../contract';
import { orderPresets, presetFromAnswers } from '../presets';
import {
  gatheringKind,
  GATHERING_ERRORS_SAMPLE,
  GATHERING_SAMPLE,
  GATHERING_SAMPLE_CONTEXT,
  GATHERING_SERIES_SAMPLE,
  GATHERING_SERIES_SAMPLE_CONTEXT,
  emptyGatheringAnswers,
} from '../kinds/gathering';
import { postKind, POST_SAMPLE, POST_SAMPLE_CONTEXT } from '../kinds/post';
import { ARTWORK_FIXTURE, ART_CONTEXT, SERVICE_CONTEXT, SERVICE_FIXTURE, artworkFixtureKind, serviceFixtureKind } from './fixtures';

/** What happened before the screenshot, replayed as state events. */
export type HarnessStep = 'saved' | 'attempt' | 'published';

export interface HarnessPage {
  id: string;
  label: string;
  kind: FormKindId;
  schema: FormKindSchema;
  answers: Answers;
  ctx: FormContext;
  ui: Partial<FormUiState> & { layout: FormLayout };
  open?: string[];
  presetId?: string | null;
  steps: HarnessStep[];
  width: number;
}

/** "This org's usual setup", as the content_prefs store will hand it over (pass 4); here, by hand. */
export const THURSDAY_PRESET: FormPreset = {
  id: 'org:thursday-open-studio',
  name: 'Thursday open studio',
  note: 'This org’s usual setup: Studio 4, 2 hours, 24 places, a reminder the day before.',
  kind: 'gathering',
  source: 'org',
  values: { duration_minutes: 120, start_time: '18:30', location: 'Studio 4, 120 Harbord St, Toronto', attendee_limit: 24, reminder_minutes_before: 1440 },
};

/** The design's artwork preset (1f). */
export const EDITIONED_PRESET: FormPreset = {
  id: 'org:editioned-print',
  name: 'Editioned print',
  note: 'Edition of 25, framed and unframed variants, in the store.',
  kind: 'artwork',
  source: 'org',
  values: { edition_type: 'edition', edition_size: 25, price_mode: 'price', currency: 'CAD', shows: { store: true, gallery: true } },
};

export function harnessPresets(kind: FormKindId): FormPreset[] {
  if (kind === 'post') return orderPresets('post', [], presetFromAnswers('post', POST_SAMPLE, ''));
  if (kind === 'artwork') return orderPresets('artwork', [EDITIONED_PRESET], null);
  if (kind === 'service') return orderPresets('service', [], null);
  return orderPresets('gathering', [THURSDAY_PRESET], null);
}

/** 12:04 and 12:14 in Toronto on Tue 10 Nov 2026, the design's saved and published times. */
export const SAVED_AT = '2026-11-10T17:04:00.000Z';
export const PUBLISHED_AT = '2026-11-10T17:14:00.000Z';

const post = (id: string, label: string, ui: HarnessPage['ui'], steps: HarnessStep[], width = 1320): HarnessPage => ({
  id,
  label,
  kind: 'post',
  schema: postKind,
  answers: POST_SAMPLE,
  ctx: POST_SAMPLE_CONTEXT,
  ui,
  steps,
  width,
});

/**
 * A new series, not saved yet: "Present it as a series" is a new-only choice (soft tissue's
 * When reads SectionProps.recordId), so replaying a save would hide the checkbox 1c shows.
 */
const series = (id: string, label: string, ui: HarnessPage['ui'], width = 1320): HarnessPage => ({
  id,
  label,
  kind: 'gathering',
  schema: gatheringKind,
  answers: GATHERING_SERIES_SAMPLE,
  ctx: GATHERING_SERIES_SAMPLE_CONTEXT,
  ui,
  open: [],
  presetId: THURSDAY_PRESET.id,
  steps: [],
  width,
});

const artwork = (id: string, label: string, ui: HarnessPage['ui'], open: string[], width = 1320): HarnessPage => ({
  id,
  label,
  kind: 'artwork',
  schema: artworkFixtureKind,
  answers: ARTWORK_FIXTURE,
  ctx: ART_CONTEXT,
  ui,
  open,
  presetId: EDITIONED_PRESET.id,
  steps: ['saved'],
  width,
});

const service = (id: string, label: string, ui: HarnessPage['ui'], width = 1320): HarnessPage => ({
  id,
  label,
  kind: 'service',
  schema: serviceFixtureKind,
  answers: SERVICE_FIXTURE,
  ctx: SERVICE_CONTEXT,
  ui,
  open: [],
  steps: ['saved'],
  width,
});

export const HARNESS_PAGES: Record<string, HarnessPage> = {
  '1a': post('1a', 'Shell, Post, fixed preview', { layout: 'split' }, ['saved']),
  '2a': post('2a', 'Post, preview behind the top-bar toggle', { layout: 'toggle', previewOpen: false }, ['saved']),
  '2b': post('2b', 'Post, the sidebar switched to Preview', { layout: 'rail', previewOpen: true }, ['saved']),
  '1b': {
    id: '1b',
    label: 'Gathering, RSVP and Emails open',
    kind: 'gathering',
    schema: gatheringKind,
    answers: GATHERING_SAMPLE,
    ctx: GATHERING_SAMPLE_CONTEXT,
    ui: { layout: 'split' },
    open: ['rsvp', 'emails'],
    presetId: THURSDAY_PRESET.id,
    steps: ['saved'],
    width: 1320,
  },
  '1h': {
    id: '1h',
    label: 'Validation: Publish pressed with errors',
    kind: 'gathering',
    schema: gatheringKind,
    answers: GATHERING_ERRORS_SAMPLE,
    ctx: GATHERING_SAMPLE_CONTEXT,
    ui: { layout: 'split' },
    open: [],
    presetId: THURSDAY_PRESET.id,
    steps: ['attempt', 'saved'],
    width: 1320,
  },
  '1j': post('1j', 'After publish, focus mode', { layout: 'split', stage: 'published' }, ['published']),
  '1l': post('1l', 'Phone: Post, full scroll', { layout: 'toggle', mobileTab: 'form' }, ['saved'], 390),
  '1m': post('1m', 'Phone: Post, Preview tab', { layout: 'toggle', mobileTab: 'preview' }, ['saved'], 390),
  '1n': {
    id: '1n',
    label: 'Phone: Gathering',
    kind: 'gathering',
    schema: gatheringKind,
    answers: GATHERING_SAMPLE,
    ctx: GATHERING_SAMPLE_CONTEXT,
    ui: { layout: 'toggle', mobileTab: 'form' },
    open: [],
    presetId: THURSDAY_PRESET.id,
    steps: ['saved'],
    width: 390,
  },
  blank: {
    id: 'blank',
    label: 'A fresh gathering (readiness: four things left)',
    kind: 'gathering',
    schema: gatheringKind,
    answers: emptyGatheringAnswers(GATHERING_SAMPLE_CONTEXT),
    ctx: GATHERING_SAMPLE_CONTEXT,
    ui: { layout: 'toggle' },
    steps: [],
    width: 1320,
  },
  // ── pass 2 ──
  '1c': series('1c', 'Gathering with Repeat on, as a series: the planner', { layout: 'split' }),
  '1c-page': series('1c-page', 'Series, the preview on Page', { layout: 'split', previewMode: 'page' }),
  '1o': series('1o', 'Phone: the series planner', { layout: 'toggle', mobileTab: 'form' }, 390),
  '1f': artwork('1f', 'Artwork: Details and Edition open', { layout: 'split' }, ['details', 'edition']),
  '1f-page': artwork('1f-page', 'Artwork, the preview on Page', { layout: 'split', previewMode: 'page' }, ['details', 'edition']),
  '1p': artwork('1p', 'Phone: Artwork, Details open', { layout: 'toggle', mobileTab: 'form' }, ['details', 'edition'], 390),
  service: service('service', 'Offering', { layout: 'split' }),
  'service-page': service('service-page', 'Offering, the preview on Page', { layout: 'split', previewMode: 'page' }),
  'service-m': service('service-m', 'Phone: Offering', { layout: 'toggle', mobileTab: 'form' }, 390),
};

/** 1i is a sheet of field states, not a form. */
export const STATES_PAGE = { id: '1i', label: 'Field states shared by every kind', width: 900 };
