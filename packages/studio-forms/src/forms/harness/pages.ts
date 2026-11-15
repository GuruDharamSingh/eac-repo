// ============================================================================
// The harness pages, one per canvas id in "Publishing Forms.dc.html":
//   pass 1: 1a, 2a, 2b, 1b, 1h, 1i, 1j, 1l, 1m, 1n, plus `blank` (a fresh
//           meeting: the readiness line must say "Four things left before it
//           can go out.")
//   pass 2: 1f (artwork), `service` (an offering), 1p and `service-m`
//           (phones), and `1f-page`,
//           `service-page` (the preview's Page view), plus `joints` / `joints-m`
//           (GridRows, PicturesField and CreditRows on their own, every state).
//           1d/1e (the planner alternates) are pass 4.
// Each is drawn in three looks by scripts/forms-harness: Broadsheet, plain (no
// theme, so every --frm-* falls back), and a dark site's themeVars. Sample data
// is soft tissue's (kinds/*/sample.ts); nothing is saved.
// ============================================================================

import type { Answers, FormContext, FormKindId, FormKindSchema, FormLayout, FormPreset, FormUiState } from '../contract';
import { orderPresets, presetFromAnswers } from '../presets';
import {
  meetingKind,
  MEETING_ERRORS_SAMPLE,
  MEETING_SAMPLE,
  MEETING_SAMPLE_CONTEXT,
  emptyMeetingAnswers,
} from '../kinds/meeting';
import { postKind, sitePostKind, POST_SAMPLE, POST_SAMPLE_CONTEXT } from '../kinds/post';
import { seriesKind } from '../kinds/series';
import { workshopKind } from '../kinds/workshop';
import { eventKind } from '../kinds/meeting';
import { artworkKind, ARTWORK_SAMPLE, ARTWORK_SAMPLE_CONTEXT } from '../kinds/artwork';
import { serviceKind, SERVICE_SAMPLE, SERVICE_SAMPLE_CONTEXT } from '../kinds/service';

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
  /** The FormShell tier; default 'focus'. */
  tier?: 'focus' | 'quick';
}

/** "This org's usual setup", as the content_prefs store will hand it over (pass 4); here, by hand. */
export const THURSDAY_PRESET: FormPreset = {
  id: 'org:thursday-open-studio',
  name: 'Thursday open studio',
  note: 'This org’s usual setup: Studio 4, 2 hours, 24 places, a reminder the day before.',
  kind: 'meeting',
  source: 'org',
  values: { duration_minutes: 120, start_time: '18:30', location: 'Studio 4, 120 Harbord St, Toronto', attendee_limit: 24, reminder_minutes_before: 1440 },
};

/** The design's artwork preset (1f), with what commerce stores today: no edition size, no variants (soft tissue's deferred list). */
export const EDITIONED_PRESET: FormPreset = {
  id: 'org:editioned-print',
  name: 'Editioned print',
  note: 'An edition, priced in CAD, in the store.',
  kind: 'artwork',
  source: 'org',
  values: { edition_type: 'edition', price_mode: 'price', currency: 'CAD' },
};

export function harnessPresets(kind: FormKindId): FormPreset[] {
  if (kind === 'post') return orderPresets('post', [], presetFromAnswers('post', POST_SAMPLE, ''));
  if (kind === 'artwork') return orderPresets('artwork', [EDITIONED_PRESET], null);
  if (kind === 'service') return orderPresets('service', [], null);
  return orderPresets('meeting', [THURSDAY_PRESET], null);
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

const artwork = (id: string, label: string, ui: HarnessPage['ui'], open: string[], width = 1320): HarnessPage => ({
  id,
  label,
  kind: 'artwork',
  schema: artworkKind,
  answers: ARTWORK_SAMPLE,
  ctx: ARTWORK_SAMPLE_CONTEXT,
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
  schema: serviceKind,
  answers: SERVICE_SAMPLE,
  ctx: SERVICE_SAMPLE_CONTEXT,
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
    label: 'Meeting, RSVP and Emails open',
    kind: 'meeting',
    schema: meetingKind,
    answers: MEETING_SAMPLE,
    ctx: MEETING_SAMPLE_CONTEXT,
    ui: { layout: 'split' },
    open: ['rsvp', 'emails'],
    presetId: THURSDAY_PRESET.id,
    steps: ['saved'],
    width: 1320,
  },
  '1h': {
    id: '1h',
    label: 'Validation: Publish pressed with errors',
    kind: 'meeting',
    schema: meetingKind,
    answers: MEETING_ERRORS_SAMPLE,
    ctx: MEETING_SAMPLE_CONTEXT,
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
    label: 'Phone: Meeting',
    kind: 'meeting',
    schema: meetingKind,
    answers: MEETING_SAMPLE,
    ctx: MEETING_SAMPLE_CONTEXT,
    ui: { layout: 'toggle', mobileTab: 'form' },
    open: [],
    presetId: THURSDAY_PRESET.id,
    steps: ['saved'],
    width: 390,
  },
  blank: {
    id: 'blank',
    label: 'A fresh meeting (readiness: four things left)',
    kind: 'meeting',
    schema: meetingKind,
    answers: emptyMeetingAnswers(MEETING_SAMPLE_CONTEXT),
    ctx: MEETING_SAMPLE_CONTEXT,
    ui: { layout: 'toggle' },
    steps: [],
    width: 1320,
  },
  // ── pass 2 ──
  '1f': artwork('1f', 'Artwork: Details and Edition open', { layout: 'split' }, ['details', 'edition']),
  '1f-page': artwork('1f-page', 'Artwork, the preview on Page', { layout: 'split', previewMode: 'page' }, ['details', 'edition']),
  '1p': artwork('1p', 'Phone: Artwork, Details open', { layout: 'toggle', mobileTab: 'form' }, ['details', 'edition'], 390),
  service: service('service', 'Offering', { layout: 'split' }),
  'service-page': service('service-page', 'Offering, the preview on Page', { layout: 'split', previewMode: 'page' }),
  'service-m': service('service-m', 'Phone: Offering', { layout: 'toggle', mobileTab: 'form' }, 390),
  // ── Quick-Form (2026-11-14): the quick tier at the popup's width, as the approved canvas ──
  'q-meeting': {
    id: 'q-meeting',
    label: 'Quick-Form: meeting, a place and a Talk room',
    kind: 'meeting',
    schema: meetingKind,
    answers: { ...MEETING_SAMPLE, where_mode: 'place+talk', create_talk_room: true, format: 'hybrid' },
    ctx: { ...MEETING_SAMPLE_CONTEXT, fields: { ...MEETING_SAMPLE_CONTEXT.fields, canCreateTalkRoom: true } },
    ui: { layout: 'toggle' },
    steps: [],
    width: 460,
    tier: 'quick',
  },
  'q-event': {
    id: 'q-event',
    label: 'Quick-Form: event',
    kind: 'event',
    schema: eventKind,
    answers: { ...MEETING_SAMPLE, title: 'Spring print fair', where_mode: 'place', create_talk_room: false, format: 'in_person' },
    ctx: MEETING_SAMPLE_CONTEXT,
    ui: { layout: 'toggle' },
    steps: [],
    width: 460,
    tier: 'quick',
  },
  'q-post': {
    id: 'q-post',
    label: 'Quick-Form: a site post',
    kind: 'post',
    schema: sitePostKind,
    answers: POST_SAMPLE,
    ctx: POST_SAMPLE_CONTEXT,
    ui: { layout: 'toggle' },
    steps: [],
    width: 460,
    tier: 'quick',
  },
  'q-series': {
    id: 'q-series',
    label: 'Quick-Form: a series on chosen dates',
    kind: 'series',
    schema: seriesKind,
    answers: { ...seriesKind.empty(MEETING_SAMPLE_CONTEXT), title: 'Reading circle: the long novels', excerpt: 'One book a season, read aloud', series_mode: 'dates', series_dates: ['2026-11-26T19:00', '2026-12-10T19:00', ''], duration_minutes: 90 },
    ctx: MEETING_SAMPLE_CONTEXT,
    ui: { layout: 'toggle' },
    steps: [],
    width: 460,
    tier: 'quick',
  },
  'q-series-weekly': {
    id: 'q-series-weekly',
    label: 'Quick-Form: a weekly series',
    kind: 'series',
    schema: seriesKind,
    answers: { ...seriesKind.empty(MEETING_SAMPLE_CONTEXT), title: 'Thursday printmaking', scheduled_at: '2026-11-19T18:30', start_time: '18:30', series_every_weeks: 2, recurrence_until: '2027-02-25' },
    ctx: MEETING_SAMPLE_CONTEXT,
    ui: { layout: 'toggle' },
    steps: [],
    width: 460,
    tier: 'quick',
  },
  'q-workshop': {
    id: 'q-workshop',
    label: 'Quick-Form: workshop',
    kind: 'workshop',
    schema: workshopKind,
    answers: { ...workshopKind.empty(MEETING_SAMPLE_CONTEXT), title: 'Linocut in a day', excerpt: 'Cut, ink and print your first block', scheduled_at: '2026-12-05T10:00', duration_minutes: 360, format: 'in_person', location: 'Studio 4, 120 Harbord St', price: 85, currency: 'CAD' },
    ctx: MEETING_SAMPLE_CONTEXT,
    ui: { layout: 'toggle' },
    steps: [],
    width: 460,
    tier: 'quick',
  },
  'q-artwork': {
    id: 'q-artwork',
    label: 'Quick-Form: artwork',
    kind: 'artwork',
    schema: artworkKind,
    answers: ARTWORK_SAMPLE,
    ctx: ARTWORK_SAMPLE_CONTEXT,
    ui: { layout: 'toggle' },
    steps: [],
    width: 460,
    tier: 'quick',
  },
};

/** 1i is a sheet of field states, not a form. */
export const STATES_PAGE = { id: '1i', label: 'Field states shared by every kind', width: 900 };

/** The pass 2 joints on their own, at a form column's width and at a phone's. */
export const JOINTS_PAGES: Record<string, { id: string; label: string; width: number }> = {
  joints: { id: 'joints', label: 'GridRows, PicturesField, CreditRows: every state', width: 900 },
  'joints-m': { id: 'joints-m', label: 'The same at 390', width: 390 },
};
