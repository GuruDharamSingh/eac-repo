// ============================================================================
// The harness pages, one per canvas id in "Publishing Forms.dc.html" that pass
// 1 covers (1a, 2a, 2b, 1b, 1h, 1i, 1j, 1l, 1m, 1n), plus `blank` (a fresh
// gathering: the readiness line must say "Four things left before it can go
// out."). Each is drawn in three looks by scripts/forms-harness: Broadsheet,
// plain (no theme, so every --frm-* falls back), and a dark site's themeVars.
// Sample data is soft tissue's (kinds/*/sample.ts); nothing is saved.
// ============================================================================

import type { Answers, FormContext, FormKindId, FormLayout, FormPreset, FormUiState } from '../contract';
import { orderPresets, presetFromAnswers } from '../presets';
import { GATHERING_ERRORS_SAMPLE, GATHERING_SAMPLE, GATHERING_SAMPLE_CONTEXT, emptyGatheringAnswers } from '../kinds/gathering';
import { POST_SAMPLE, POST_SAMPLE_CONTEXT } from '../kinds/post';

/** What happened before the screenshot, replayed as state events. */
export type HarnessStep = 'saved' | 'attempt' | 'published';

export interface HarnessPage {
  id: string;
  label: string;
  kind: Extract<FormKindId, 'post' | 'gathering'>;
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

export function harnessPresets(kind: 'post' | 'gathering'): FormPreset[] {
  if (kind === 'post') return orderPresets('post', [], presetFromAnswers('post', POST_SAMPLE, ''));
  return orderPresets('gathering', [THURSDAY_PRESET], null);
}

/** 12:04 and 12:14 in Toronto on Tue 10 Nov 2026, the design's saved and published times. */
export const SAVED_AT = '2026-11-10T17:04:00.000Z';
export const PUBLISHED_AT = '2026-11-10T17:14:00.000Z';

const post = (id: string, label: string, ui: HarnessPage['ui'], steps: HarnessStep[], width = 1320): HarnessPage => ({
  id,
  label,
  kind: 'post',
  answers: POST_SAMPLE,
  ctx: POST_SAMPLE_CONTEXT,
  ui,
  steps,
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
    answers: emptyGatheringAnswers(GATHERING_SAMPLE_CONTEXT),
    ctx: GATHERING_SAMPLE_CONTEXT,
    ui: { layout: 'toggle' },
    steps: [],
    width: 1320,
  },
};

/** 1i is a sheet of field states, not a form. */
export const STATES_PAGE = { id: '1i', label: 'Field states shared by every kind', width: 900 };
