'use client';

// ============================================================================
// @elkdonis/studio/forms: form state (pass 1, the bone's).
// Plan: docs/open/publishing-forms-handoff/PLAN.md §3.
//
// Pure derivations first (issues, section statuses, readiness, presets),
// then a reducer and a hook. The shell (Tendons) renders from FormState and
// calls these; kinds (Soft tissue) only declare schemas and rules.
//
// Ported from the design's renderVals(): the rail lists come from the schema's
// sections, a section's status from its rules and values, and the readiness
// line from the issue counts. Issues are always computed but only SHOWN once
// Publish has been pressed (validationAttempted), as the design asks.
// ============================================================================

import * as React from 'react';
import { buildContentFields, type ContentFieldContext, type ContentKind } from '@elkdonis/cms-ui/compose';
import type {
  Answers,
  CodeKind,
  FormActions,
  FormContext,
  FormIssue,
  FormKindSchema,
  FormPreset,
  FormSection,
  FormState,
  SectionStatus,
} from './contract';

// ── answers ──────────────────────────────────────────────────────────────────

/** Filled the way cms-ui's groupHasValues reads it: not empty, not false, not an empty list. */
export function isFilled(v: unknown): boolean {
  if (v === undefined || v === null || v === '' || v === false) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).some(isFilled);
  return true;
}

/** Read a dotted key ("forms.emails.reminder") from answers. Top-level keys are the common case. */
export function readAnswer(a: Answers, key: string): unknown {
  if (key in a) return a[key];
  return key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), a);
}

/** The cms-ui ContentKind whose field list a code kind uses. */
export function contentKindOf(code: CodeKind): ContentKind | null {
  switch (code) {
    case 'writing':
    case 'post':
      return 'post';
    case 'meeting':
      return 'meeting';
    case 'series':
      return 'series';
    case 'service':
      return 'service';
    default:
      return null; // artwork: its fields are the artwork composer's, not content-fields'
  }
}

/** Every field name a section draws: its own `fields` plus the fields of its cms-ui `groups`. */
export function sectionFieldNames(section: FormSection, schema: FormKindSchema, answers: Answers, ctx: FormContext): string[] {
  const names = [...(section.fields ?? [])];
  if (section.groups?.length) {
    const ck = contentKindOf(schema.codeKind(answers));
    if (ck) {
      const groups = buildContentFields(ck, ctx.fields as ContentFieldContext);
      for (const g of groups) if (section.groups.includes(g.id)) names.push(...g.fields.map((f) => f.name));
    }
  }
  return [...new Set(names)];
}

/** Sections shown for these answers (series-only sections drop out for a one-off gathering). */
export function visibleSections(
  schema: FormKindSchema,
  answers: Answers,
  ctx: FormContext,
  tier: 'essentials' | 'more' | 'all' = 'all'
): FormSection[] {
  return schema.sections.filter((s) => (tier === 'all' || s.tier === tier) && (!s.when || s.when(answers, ctx)));
}

// ── issues ───────────────────────────────────────────────────────────────────

/** Run the kind's rules, plus the server's field errors (always blocking, mapped to the section that draws the field). */
export function computeIssues(
  schema: FormKindSchema,
  answers: Answers,
  ctx: FormContext,
  serverErrors?: Record<string, string[] | undefined>
): FormIssue[] {
  const out: FormIssue[] = [];
  const shown = new Set(visibleSections(schema, answers, ctx).map((s) => s.id));
  for (const r of schema.rules) {
    if (!shown.has(r.section)) continue;
    let failed = false;
    try {
      failed = r.test(answers, ctx);
    } catch {
      failed = false; // a rule that throws on half-typed input is not a finding
    }
    if (failed) out.push({ ruleId: r.id, severity: r.severity, fields: r.fields, section: r.section, message: r.message, short: r.short, source: 'rule' });
  }
  if (serverErrors) {
    for (const [field, msgs] of Object.entries(serverErrors)) {
      if (!msgs?.length) continue;
      const section =
        schema.sections.find((s) => sectionFieldNames(s, schema, answers, ctx).includes(field))?.id ?? schema.sections[0]?.id ?? 'form';
      out.push({ ruleId: `server:${field}`, severity: 'block', fields: [field], section, message: msgs.join('. '), short: msgs[0]!, source: 'server' });
    }
  }
  return out;
}

export function blocking(issues: FormIssue[]): FormIssue[] {
  return issues.filter((i) => i.severity === 'block');
}

// ── rail ─────────────────────────────────────────────────────────────────────

/**
 * done: holds something (or is essential and has no problem); empty: optional and untouched;
 * error/warning: a shown issue sits in it. Issues count only once validation was attempted,
 * except server errors, which always show.
 */
export function sectionStatus(
  section: FormSection,
  schema: FormKindSchema,
  state: Pick<FormState, 'answers' | 'issues' | 'validationAttempted'>,
  ctx: FormContext
): SectionStatus {
  const live = state.issues.filter((i) => i.section === section.id && (state.validationAttempted || i.source === 'server'));
  if (live.some((i) => i.severity === 'block')) return 'error';
  if (live.some((i) => i.severity === 'warn')) return 'warning';
  const names = sectionFieldNames(section, schema, state.answers, ctx);
  const filled = names.some((n) => isFilled(readAnswer(state.answers, n)));
  if (filled) return 'done';
  return section.tier === 'essentials' && !state.validationAttempted ? 'empty' : section.tier === 'essentials' ? 'done' : 'empty';
}

export interface Readiness {
  /** `pending`: things are missing but Publish has not been pressed yet, so nothing is marked as an error. */
  status: 'ready' | 'pending' | 'blocked' | 'warned' | 'published';
  text: string;
}

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
function countWord(n: number, capital = false): string {
  const w = n < COUNT_WORDS.length ? COUNT_WORDS[n]! : String(n);
  return capital ? w : w.toLowerCase();
}

/**
 * The rail's last line. Before the first Publish press only server issues are shown, but the line
 * never claims "Ready" while hidden blocks exist: it says how many things are left, neutrally.
 */
export function readiness(
  state: Pick<FormState, 'issues' | 'publishedAt' | 'validationAttempted'>,
  formatTime: (iso: string) => string
): Readiness {
  if (state.publishedAt) return { status: 'published', text: `Published at ${formatTime(state.publishedAt)}. Edits go live when you save.` };
  const shown = state.issues.filter((i) => state.validationAttempted || i.source === 'server');
  const hiddenBlocks = state.issues.filter((i) => i.severity === 'block' && !shown.includes(i)).length;
  const b = shown.filter((i) => i.severity === 'block').length;
  const w = shown.filter((i) => i.severity === 'warn').length;
  if (!b && hiddenBlocks) {
    return { status: 'pending', text: `${countWord(hiddenBlocks, true)} ${hiddenBlocks === 1 ? 'thing' : 'things'} left before it can go out.` };
  }
  if (b) {
    const things = `${b} ${b === 1 ? 'thing' : 'things'} to fix before it can go out.`;
    return { status: 'blocked', text: w ? `${things} ${w} ${w === 1 ? 'warning' : 'warnings'}.` : things };
  }
  if (w) return { status: 'warned', text: `Ready to publish. ${w} ${w === 1 ? 'warning' : 'warnings'}.` };
  return { status: 'ready', text: 'Ready to publish' };
}

/** The alert's title: "Two things before this can go out". */
export function alertTitle(issues: FormIssue[]): string {
  const n = blocking(issues).length;
  return `${countWord(n, true)} ${n === 1 ? 'thing' : 'things'} before this can go out`;
}

// ── presets ──────────────────────────────────────────────────────────────────

/** Merge a preset's values and remember which fields it filled. Fields the person already typed are kept. */
export function applyPreset(state: FormState, preset: FormPreset, defaults: Answers): FormState {
  const answers = { ...state.answers };
  const fromPreset: Record<string, string> = {};
  for (const [k, v] of Object.entries(preset.values)) {
    const typed = isFilled(state.answers[k]) && JSON.stringify(state.answers[k]) !== JSON.stringify(defaults[k]) && !state.fromPreset[k];
    if (typed) continue;
    answers[k] = v;
    fromPreset[k] = preset.name;
  }
  return { ...state, answers, fromPreset, presetId: preset.id };
}

// ── reducer ──────────────────────────────────────────────────────────────────

export type FormEvent =
  | { type: 'patch'; fields: Partial<Answers> }
  | { type: 'toggleSection'; id: string; open?: boolean }
  | { type: 'applyPreset'; preset: FormPreset }
  | { type: 'attemptPublish' }
  | { type: 'saveStart' }
  | { type: 'saveDone'; id: string; record: unknown; at: string; published: boolean; serverErrors?: Record<string, string[]> }
  | { type: 'saveFail'; serverErrors?: Record<string, string[]> }
  | { type: 'unpublish' }
  | { type: 'load'; answers: Answers; id: string; record: unknown; publishedAt: string | null };

export interface FormReducerDeps {
  schema: FormKindSchema;
  ctx: FormContext;
  defaults: Answers;
}

export function initialFormState(deps: FormReducerDeps, init?: Partial<FormState>): FormState {
  const answers = init?.answers ?? deps.defaults;
  const base: FormState = {
    kind: deps.schema.id,
    answers,
    openSections: init?.openSections ?? deps.schema.defaultOpen(answers),
    fromPreset: init?.fromPreset ?? {},
    presetId: init?.presetId ?? null,
    issues: [],
    validationAttempted: false,
    saveStatus: 'idle',
    savedAt: null,
    publishedAt: init?.publishedAt ?? null,
    id: init?.id ?? null,
    record: init?.record ?? null,
  };
  return { ...base, issues: computeIssues(deps.schema, answers, deps.ctx) };
}

export function formReducer(deps: FormReducerDeps) {
  return (state: FormState, ev: FormEvent): FormState => {
    const reissue = (s: FormState, serverErrors?: Record<string, string[]>) => ({
      ...s,
      issues: computeIssues(deps.schema, s.answers, deps.ctx, serverErrors),
    });
    switch (ev.type) {
      case 'patch': {
        const fromPreset = { ...state.fromPreset };
        for (const k of Object.keys(ev.fields)) delete fromPreset[k];
        return reissue({ ...state, answers: { ...state.answers, ...ev.fields }, fromPreset, saveStatus: state.saveStatus === 'saved' ? 'idle' : state.saveStatus });
      }
      case 'toggleSection': {
        const isOpen = state.openSections.includes(ev.id);
        const open = ev.open ?? !isOpen;
        const openSections = open ? (isOpen ? state.openSections : [...state.openSections, ev.id]) : state.openSections.filter((x) => x !== ev.id);
        return { ...state, openSections };
      }
      case 'applyPreset':
        return reissue(applyPreset(state, ev.preset, deps.defaults));
      case 'attemptPublish':
        return { ...reissue(state), validationAttempted: true };
      case 'saveStart':
        return { ...state, saveStatus: 'saving' };
      case 'saveDone':
        return reissue(
          {
            ...state,
            saveStatus: 'saved',
            savedAt: ev.at,
            id: ev.id,
            record: ev.record,
            publishedAt: ev.published ? state.publishedAt ?? ev.at : state.publishedAt,
          },
          ev.serverErrors
        );
      case 'saveFail':
        return reissue({ ...state, saveStatus: 'error' }, ev.serverErrors);
      case 'unpublish':
        return { ...state, publishedAt: null };
      case 'load':
        return reissue({ ...state, answers: ev.answers, id: ev.id, record: ev.record, publishedAt: ev.publishedAt, saveStatus: 'saved' });
    }
  };
}

// ── hook ─────────────────────────────────────────────────────────────────────

export interface UseFormStateOptions {
  schema: FormKindSchema;
  ctx: FormContext;
  orgId: string;
  actions?: FormActions;
  init?: Partial<FormState>;
  /**
   * Save drafts to the server as the person types (owner ruling 2026-11-08: draft
   * gatherings stay off the org calendar, which every calendar query already
   * guarantees: org-calendar.ts listOrgEventsInRange and the Nextcloud mirror read
   * status 'published' only). Off for a published item: its edits go live on Save.
   */
  autosaveMs?: number | null;
  onPublished?: (record: unknown) => void;
}

export interface FormController {
  state: FormState;
  dispatch: React.Dispatch<FormEvent>;
  patch: (fields: Partial<Answers>) => void;
  toggleSection: (id: string, open?: boolean) => void;
  applyPreset: (preset: FormPreset) => void;
  saveDraft: () => Promise<boolean>;
  /** Saves the draft first; publishes only when nothing blocks (design §7). */
  publish: () => Promise<'published' | 'blocked' | 'failed'>;
}

export function useFormState(opts: UseFormStateOptions): FormController {
  const { schema, ctx, orgId, actions, init, autosaveMs = 2500, onPublished } = opts;
  const defaults = React.useMemo(() => schema.empty(ctx), [schema, ctx]);
  const deps = React.useMemo<FormReducerDeps>(() => ({ schema, ctx, defaults }), [schema, ctx, defaults]);
  const reducer = React.useMemo(() => formReducer(deps), [deps]);
  const [state, dispatch] = React.useReducer(reducer, undefined, () => initialFormState(deps, init));

  const stateRef = React.useRef(state);
  stateRef.current = state;
  const inFlight = React.useRef<Promise<unknown> | null>(null);

  const save = React.useCallback(
    async (intent: 'draft' | 'published'): Promise<boolean> => {
      if (!actions) return false;
      if (inFlight.current) await inFlight.current.catch(() => undefined);
      const s = stateRef.current;
      dispatch({ type: 'saveStart' });
      const p = actions.save(orgId, s.answers, intent, s.id);
      inFlight.current = p;
      try {
        const res = await p;
        if (!res.ok) {
          dispatch({ type: 'saveFail' });
          return false;
        }
        const v = res.value;
        const id = recordId(v.record) ?? s.id ?? '';
        dispatch({ type: 'saveDone', id, record: v.record, at: new Date().toISOString(), published: intent === 'published', serverErrors: v.fieldErrors });
        if (intent === 'published' && !v.fieldErrors) onPublished?.(v.record);
        return !v.fieldErrors;
      } catch {
        dispatch({ type: 'saveFail' });
        return false;
      } finally {
        inFlight.current = null;
      }
    },
    [actions, orgId, onPublished]
  );

  // Autosave: drafts only, after an edit, never before there is a title.
  const touched = React.useRef(false);
  React.useEffect(() => {
    if (!autosaveMs || !actions || state.publishedAt || state.saveStatus !== 'idle' || !touched.current) return;
    if (!isFilled(state.answers.title)) return;
    const t = setTimeout(() => void save('draft'), autosaveMs);
    return () => clearTimeout(t);
  }, [state.answers, state.saveStatus, state.publishedAt, autosaveMs, actions, save]);

  const patch = React.useCallback((fields: Partial<Answers>) => {
    touched.current = true;
    dispatch({ type: 'patch', fields });
  }, []);

  const publish = React.useCallback(async () => {
    dispatch({ type: 'attemptPublish' });
    const issues = computeIssues(schema, stateRef.current.answers, ctx);
    if (blocking(issues).length) {
      if (!stateRef.current.publishedAt) await save('draft'); // "Your draft is saved. Nothing has been sent."
      return 'blocked' as const;
    }
    return (await save('published')) ? ('published' as const) : ('failed' as const);
  }, [schema, ctx, save]);

  return {
    state,
    dispatch,
    patch,
    toggleSection: React.useCallback((id: string, open?: boolean) => dispatch({ type: 'toggleSection', id, open }), []),
    applyPreset: React.useCallback((preset: FormPreset) => {
      touched.current = true;
      dispatch({ type: 'applyPreset', preset });
    }, []),
    saveDraft: React.useCallback(() => save('draft'), [save]),
    publish,
  };
}

function recordId(record: unknown): string | null {
  if (record && typeof record === 'object' && 'id' in record) {
    const id = (record as { id: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}
