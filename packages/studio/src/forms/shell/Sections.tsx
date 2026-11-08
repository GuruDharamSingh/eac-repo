'use client';

import * as React from 'react';
import { buildContentFields, type ContentFieldContext, type ContentFieldSpec } from '@elkdonis/cms-ui/compose';
import type { Answers, FormContext, FormHost, FormIssue, FormKindSchema, FormSection, FormState, FormTier, SectionProps } from '../contract';
import { specKindOf, visibleSections } from '../state';
import { renderField, type FieldRenderContext, type ShellFieldOverride } from '../fields/FieldRenderer';
import { sectionAnchor } from '../fields/ids';
import { MoreRow } from '../fields/MoreRow';
import { paragraphs } from '../preview/format';
import { bodyEditorOf } from './ui';

// ============================================================================
// The form column's sections, drawn generically from any FormKindSchema:
//
//   a section with `render` → schema.components[render] with SectionProps
//   a section with `fields`/`groups` → the cms-ui fields, through FieldRenderer
//
// Essentials are blocks under a heading the SHELL draws (the kinds never draw
// headings; their fields pass hideLabel and keep the label as the accessible
// name). The title section has no heading: the headline is its own label.
// More sections are MoreRows with the kind's summary while closed, or the
// first shown problem. Deferred sections are never drawn (owner ruling 7).
// ============================================================================

export function shownIssues(state: Pick<FormState, 'issues' | 'validationAttempted'>): FormIssue[] {
  return state.issues.filter((i) => state.validationAttempted || i.source === 'server');
}

/**
 * The field specs a kind draws with, by name: cms-ui's content-fields list for the kind's
 * spec kind (state.ts specKindOf: a gathering keeps 'meeting' as a series), with the kind's
 * own `specs` merged over it (artwork's fields content-fields does not declare), or those
 * alone when there is no list.
 */
export function useFieldSpecs(schema: FormKindSchema, answers: Answers, ctx: FormContext) {
  const ck = specKindOf(schema, answers);
  const groups = React.useMemo(() => (ck ? buildContentFields(ck, ctx.fields as ContentFieldContext) : []), [ck, ctx.fields]);
  const own = schema.specs;
  const specs = React.useMemo(() => {
    const m: Record<string, ContentFieldSpec> = {};
    for (const g of groups) for (const f of g.fields) if (!(f.name in m)) m[f.name] = f;
    if (own) for (const [name, spec] of Object.entries(own)) m[name] = spec;
    return m;
  }, [groups, own]);
  return { groups, specs };
}

/** The headline's spec when the kind's list has no `title` (drawn rather than dropped). */
const TITLE_FALLBACK: ShellFieldOverride = { input: 'text', label: 'Title' };

function namesOf(section: FormSection, groups: ReturnType<typeof useFieldSpecs>['groups']): string[] {
  const names = [...(section.fields ?? [])];
  if (section.groups?.length) for (const g of groups) if (section.groups.includes(g.id)) names.push(...g.fields.map((f) => f.name));
  return [...new Set(names)];
}

function blurbOf(section: FormSection, groups: ReturnType<typeof useFieldSpecs>['groups']): string {
  for (const g of groups) if (section.groups?.includes(g.id) && g.blurb) return g.blurb;
  return '';
}

function wordsLine(html: unknown): string {
  const words = paragraphs(html, 1000).join(' ').split(/\s+/).filter(Boolean).length;
  if (!words) return 'Nothing written yet';
  const minutes = Math.ceil(paragraphs(html, 1000).join(' ').length / 5 / 230);
  return `${words} ${words === 1 ? 'word' : 'words'}${minutes >= 2 ? `, about ${minutes} minutes` : ''}`;
}

/** Fields of a fields-based section, with runs of `inline` specs sharing a row. */
function fieldRuns(names: string[], rc: FieldRenderContext, override: (name: string) => ShellFieldOverride | undefined): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let row: React.ReactNode[] = [];
  const flush = () => {
    if (row.length === 1) out.push(row[0]);
    else if (row.length > 1) out.push(<div key={`row-${out.length}`} className="frm-row">{row}</div>);
    row = [];
  };
  for (const name of names) {
    const node = renderField(name, override(name), rc);
    if (node === null || node === undefined) continue;
    if (rc.specs[name]?.inline) row.push(node);
    else {
      flush();
      out.push(node);
    }
  }
  flush();
  return out;
}

export interface FormSectionsProps {
  schema: FormKindSchema;
  state: FormState;
  host: FormHost;
  ctx: FormContext;
  tier: FormTier;
  scope?: string;
  patch: (fields: Partial<Answers>) => void;
  toggleSection: (id: string, open?: boolean) => void;
  fullEditorHref?: string | null;
  /** Drawn first in the stack (the phone's "Start from" row, the alert). */
  before?: React.ReactNode;
}

export function FormSections({ schema, state, host, ctx, tier, scope = '', patch, toggleSection, fullEditorHref, before }: FormSectionsProps) {
  const { answers } = state;
  const { groups, specs } = useFieldSpecs(schema, answers, ctx);
  const issues = shownIssues(state);
  const body = bodyEditorOf(schema);
  const quickOnly = (s: FormSection) => tier !== 'quick' || s.quick;
  const essentials = visibleSections(schema, answers, ctx, 'essentials').filter(quickOnly);
  const more = tier === 'quick' ? [] : visibleSections(schema, answers, ctx, 'more');

  const rcFor = (s: FormSection, defaultSize: 'section' | 'sub'): FieldRenderContext => ({
    answers,
    patch,
    issues,
    fromPreset: state.fromPreset,
    tier,
    host,
    ctx,
    specs,
    scope,
    fullEditorHref,
    defaultSize,
    bodyEditor: body && body.section === s.id ? body.editor : 'toolbar',
  });

  const sectionProps = (s: FormSection): SectionProps => {
    const rc = rcFor(s, 'sub');
    return {
      answers,
      patch,
      ctx,
      issues: issues.filter((i) => i.section === s.id),
      fromPreset: state.fromPreset,
      tier,
      host,
      recordId: state.id,
      field: (name, override) => renderField(name, override as ShellFieldOverride | undefined, rc),
    };
  };

  const custom = (s: FormSection) => {
    const C = s.render ? schema.components?.[s.render] : undefined;
    return C ? <C {...sectionProps(s)} /> : <p className="frm-missing">This section has no component for "{s.render}".</p>;
  };

  const essential = (s: FormSection) => {
    const anchor = sectionAnchor(s.id, scope);
    const names = namesOf(s, groups);
    const headingId = `${anchor}-h`;
    if (s.render) {
      return (
        <div key={s.id} className="frm-sec" id={anchor} role="group" aria-labelledby={headingId}>
          <h3 className="frm-sec-label" id={headingId}>
            {s.label}
          </h3>
          {custom(s)}
        </div>
      );
    }
    if (names.length === 1 && names[0] === 'title') {
      return (
        <div key={s.id} className="frm-sec" id={anchor}>
          {renderField('title', specs.title ? undefined : TITLE_FALLBACK, rcFor(s, 'section'))}
        </div>
      );
    }
    const isBody = body && body.section === s.id;
    const blocks = isBody && body.editor === 'blocks' && tier === 'focus' && typeof host.slots?.blocks === 'function';
    if (names.length === 1) {
      return (
        <div key={s.id} className="frm-sec" id={anchor}>
          {blocks && (
            <div className="frm-body-meta">
              <span className="frm-tag frm-tag--neutral">Blocks</span>
              <span>{wordsLine(answers[body.field])}</span>
            </div>
          )}
          {renderField(names[0]!, blocks ? { label: s.label, hideLabel: true } : { label: s.label }, rcFor(s, 'section'))}
        </div>
      );
    }
    return (
      <div key={s.id} className="frm-sec" id={anchor} role="group" aria-labelledby={headingId}>
        <h3 className="frm-sec-label" id={headingId}>
          {s.label}
        </h3>
        {fieldRuns(names, rcFor(s, 'sub'), () => undefined)}
      </div>
    );
  };

  const moreRow = (s: FormSection) => {
    const anchor = sectionAnchor(s.id, scope);
    const names = namesOf(s, groups);
    const mine = issues.filter((i) => i.section === s.id);
    const worst = mine.find((i) => i.severity === 'block') ?? mine[0];
    let summary = '';
    try {
      summary = s.summary?.(answers, ctx) ?? '';
    } catch {
      summary = '';
    }
    if (!summary) summary = blurbOf(s, groups);
    const open = state.openSections.includes(s.id);
    return (
      <MoreRow
        key={s.id}
        id={anchor}
        name={s.label}
        summary={summary}
        problem={worst ? { tone: worst.severity === 'block' ? 'error' : 'warning', text: worst.message } : null}
        open={open}
        onToggle={() => toggleSection(s.id)}
      >
        {s.render
          ? custom(s)
          : fieldRuns(names, rcFor(s, 'sub'), () => (names.length === 1 ? { label: s.label, hideLabel: true } : undefined))}
      </MoreRow>
    );
  };

  return (
    <div className="frm-stack">
      {before}
      <span className="frm-eyebrow" data-at="essentials">
        Essentials
      </span>
      {essentials.map(essential)}
      {more.length > 0 && (
        <>
          <span className="frm-eyebrow" data-at="more">
            More
          </span>
          <div className="frm-more-list">{more.map(moreRow)}</div>
        </>
      )}
    </div>
  );
}
