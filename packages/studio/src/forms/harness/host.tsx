'use client';

// ============================================================================
// The harness's host: stub actions (nothing is saved), a stub picture picker,
// the Studio essay Canvas as the focus `blocks` slot (as the Studio host will
// pass it), and the preview's site themes. Harness only: never exported from
// ./forms, so the Canvas (tiptap) here never reaches the essentials bundle.
// ============================================================================

import * as React from 'react';
import { deriveRoleRamps } from '@elkdonis/gradients';
import { renderEssayHtml, type EssayDoc } from '@elkdonis/utils/essay';
import { Canvas } from '../../canvas';
import type { Answers, FormActions, FormHost } from '../contract';
import type { BlocksSlot } from '../fields/FieldRenderer';
import type { MediaSlot } from '../fields/MediaField';
import { SAMPLE_PICTURE } from '../kinds/post';

export type HarnessTheme = 'broadsheet' | 'plain' | 'dark';

function slugify(s: unknown): string {
  return (typeof s === 'string' ? s : 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Saves nothing: echoes a record so the shell's states can be shown. */
export const STUB_ACTIONS: FormActions = {
  context: async () => ({}),
  save: async (_orgId: string, answers: Answers, _intent, id) => ({
    ok: true as const,
    value: { record: { id: id ?? 'sample-1', slug: slugify(answers.title) }, warnings: [] },
  }),
};

/** A picker that offers the one sample picture. A real host passes its MediaPicker. */
const stubMedia: MediaSlot = ({ onChange, source }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
    <span>{source === 'camera' ? 'Phone hand-off (harness stub).' : 'The org library (harness stub).'}</span>
    <button type="button" className="frm-btn frm-btn--secondary frm-btn--sm" onClick={() => onChange(SAMPLE_PICTURE)}>
      Use the sample picture
    </button>
  </div>
);

/** The Studio essay Canvas as the `blocks` slot: HTML in, rendered HTML and the document out. */
const canvasBlocks: BlocksSlot = ({ value, doc, onChange }) => (
  <Canvas
    doc={(doc as EssayDoc | null) ?? null}
    html={doc ? undefined : value}
    onChange={(d) => onChange(renderEssayHtml(d), d)}
    card={{ search: async () => [] }}
    placeholder="Start writing. Add a picture, a pull quote or a card."
  />
);

/** Elkdonis Arts Collective's site, as its site_themes would set the surface hooks (light). */
export const LIGHT_SITE_VARS: Record<string, string> = {
  '--eac-surface-bg': '#f3f2f2',
  '--eac-surface-fg': '#201e1d',
  '--eac-surface-muted': '#605d5d',
  '--eac-surface-line': '#d1d0d0',
  '--eac-surface-accent': '#0088b0',
  '--eac-surface-on-accent': '#f3f2f2',
  '--eac-surface-radius': '2px',
};

/** A dark site: surface hooks, the shared role ramps from @elkdonis/gradients, and its colour scheme. */
export const DARK_SITE_VARS: Record<string, string> = {
  '--eac-surface-bg': '#16161a',
  '--eac-surface-fg': '#ecebe6',
  '--eac-surface-muted': '#a9a7a0',
  '--eac-surface-line': '#3a3a40',
  '--eac-surface-accent': '#d9a441',
  '--eac-surface-on-accent': '#16161a',
  '--eac-accent': '#d9a441',
  '--eac-form-color-scheme': 'dark',
  ...deriveRoleRamps({ accent: '#d9a441', accent2: '#e0607e', bg: '#16161a', text: '#ecebe6' }),
};

export function harnessHost(theme: HarnessTheme, feeds: Array<{ slug: string; name: string }>): FormHost {
  return {
    // Harness links only; a real host builds these from its own routes (no form hard-codes /studio).
    studioHref: (o) => {
      const q = new URLSearchParams();
      if (o.kind) q.set('kind', o.kind);
      if (o.id) q.set('id', o.id);
      if (o.focus) q.set('focus', '1');
      if (o.preset) q.set('preset', o.preset);
      const s = q.toString();
      return `/studio${s ? `?${s}` : ''}`;
    },
    viewHref: (ref) => `https://elkdonis.art/lab-work/${ref.slug || ref.id}`,
    preview: {
      themeVars: theme === 'dark' ? DARK_SITE_VARS : LIGHT_SITE_VARS,
      neighbour: {
        post: { label: 'Earlier', title: 'A visit to the paper mill' },
        gathering: { label: 'Earlier', title: 'Bookbinding, a Saturday' },
        series: { label: 'Earlier', title: 'Bookbinding, a Saturday' },
        artwork: { label: 'Earlier', title: 'Low tide, No. 1' },
        service: { label: 'Also offered', title: 'Paper marbling, an afternoon' },
      },
    },
    feeds,
    actions: { post: STUB_ACTIONS, gathering: STUB_ACTIONS, artwork: STUB_ACTIONS, service: STUB_ACTIONS },
    slots: { media: stubMedia, blocks: canvasBlocks },
  };
}
