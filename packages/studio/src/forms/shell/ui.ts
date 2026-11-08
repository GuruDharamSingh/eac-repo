'use client';

// ============================================================================
// The shell's UI state helpers (Tendons). FormUiState is not form state: it is
// where the preview sits and which tab a phone shows. The host owns it (or
// uses useFormUi); the shell only reads it and asks for changes.
// ============================================================================

import * as React from 'react';
import type { FormKindId, FormKindSchema, FormUiState } from '../contract';

/** Owner ruling (PLAN §8 Q4): 2a, the top-bar toggle, is the default; still a switch. */
export const DEFAULT_FORM_UI: FormUiState = {
  layout: 'toggle',
  previewOpen: false,
  previewMode: 'card',
  mobileTab: 'form',
  stage: 'edit',
};

export function useFormUi(init?: Partial<FormUiState>): [FormUiState, (patch: Partial<FormUiState>) => void] {
  const [ui, setUi] = React.useState<FormUiState>(() => ({ ...DEFAULT_FORM_UI, ...init }));
  const patch = React.useCallback((p: Partial<FormUiState>) => setUi((u) => ({ ...u, ...p })), []);
  return [ui, patch];
}

/** What people call each kind (PLAN §8 Q1: Gathering; Service is "Offering"). */
export const KIND_NOUN: Record<FormKindId, string> = {
  post: 'Post',
  gathering: 'Gathering',
  artwork: 'Artwork',
  service: 'Offering',
};

/** "12:04", in the form's zone, from an ISO instant. Same on server and client (zone given). */
export function clockIn(timeZone: string) {
  return (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timeZone || undefined }).format(d);
    } catch {
      return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    }
  };
}

/** The kind's own layout (KindLayout, soft tissue's kinds/post/parts.tsx), read without importing a kind. */
export function bodyEditorOf(schema: FormKindSchema): { section: string; field: string; editor: 'blocks' | 'toolbar' } | null {
  const layout = (schema as FormKindSchema & { layout?: { body?: { section?: unknown; field?: unknown; editor?: unknown } } }).layout;
  const b = layout?.body;
  if (!b || typeof b.section !== 'string') return null;
  return { section: b.section, field: typeof b.field === 'string' ? b.field : 'body', editor: b.editor === 'blocks' ? 'blocks' : 'toolbar' };
}

/** "Or: Announcement, Short note, or your last post's settings." */
export function orList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `Or: ${names[0]}.`;
  if (names.length === 2) return `Or: ${names[0]} or ${names[1]}.`;
  return `Or: ${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}.`;
}
