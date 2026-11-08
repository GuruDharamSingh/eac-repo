'use client';

import * as React from 'react';
import type { FormContext, FormIconName, FormKindSchema, FormPreset, FormSection, FormState, SectionStatus } from '../contract';
import { readiness, sectionStatus, visibleSections, type Readiness } from '../state';
import { Select } from '../fields/Input';
import { sectionAnchor } from '../fields/ids';
import { Icon } from '../theme/context';
import { KIND_NOUN, clockIn, orList } from './ui';

// ============================================================================
// The rail (design §1.1): "Start from" (presets), then the index of
// Essentials and More with each section's status, then the readiness line
// pinned to the bottom. Statuses and readiness are the bone's (state.ts);
// this only draws them. Items are links to their sections, and opening a
// closed More row on the way.
// ============================================================================

const STATUS_ICON: Record<SectionStatus, FormIconName> = { done: 'done', empty: 'empty', error: 'error', warning: 'warning' };
const STATUS_WORD: Record<SectionStatus, string> = { done: 'filled in', empty: 'empty', error: 'needs fixing', warning: 'has a warning' };
const READY_ICON: Record<Readiness['status'], FormIconName> = { ready: 'done', warned: 'done', published: 'done', pending: 'empty', blocked: 'error' };

export function PresetSlot({
  id,
  schema,
  state,
  presets,
  onApply,
  showNote = true,
}: {
  id: string;
  schema: FormKindSchema;
  state: FormState;
  presets: FormPreset[];
  onApply?: (preset: FormPreset) => void;
  showNote?: boolean;
}) {
  const noun = KIND_NOUN[schema.id].toLowerCase();
  const blank = `Blank ${noun}`;
  // A platform "Blank post" with nothing in it is the empty choice itself, not a second one.
  const list = presets.filter((p) => !(Object.keys(p.values).length === 0 && p.name.toLowerCase() === blank.toLowerCase()));
  const chosen = list.find((p) => p.id === state.presetId) ?? null;
  const note = chosen ? chosen.note : orList(list.map((p) => p.name));
  return (
    <div className="frm-preset">
      <Select
        id={id}
        icon="preset"
        aria-label="Start from"
        aria-describedby={showNote && note ? `${id}-note` : undefined}
        value={chosen?.id ?? ''}
        placeholder={blank}
        options={list.map((p) => ({ value: p.id, label: p.name }))}
        disabled={!onApply}
        onChange={(e) => {
          const p = list.find((x) => x.id === e.target.value);
          if (p && onApply) onApply(p);
        }}
      />
      {showNote && note && (
        <p className="frm-preset-note" id={`${id}-note`}>
          {note}
        </p>
      )}
    </div>
  );
}

export interface RailProps {
  schema: FormKindSchema;
  state: FormState;
  ctx: FormContext;
  presets: FormPreset[];
  scope?: string;
  onApplyPreset?: (preset: FormPreset) => void;
  /** Go to a section; More rows are opened first. */
  onGo: (section: FormSection) => void;
  /** Layout `rail`: the Sections | Preview seg. */
  top?: React.ReactNode;
}

export function Rail({ schema, state, ctx, presets, scope = '', onApplyPreset, onGo, top }: RailProps) {
  const items = (tier: 'essentials' | 'more') =>
    visibleSections(schema, state.answers, ctx, tier).map((s) => {
      const st = sectionStatus(s, schema, state, ctx);
      return (
        <a
          key={s.id}
          className="frm-rail-item"
          data-status={st}
          href={`#${sectionAnchor(s.id, scope)}`}
          onClick={(e) => {
            e.preventDefault();
            onGo(s);
          }}
        >
          <Icon name={STATUS_ICON[st]} size={16} />
          <span className="frm-rail-label">{s.label}</span>
          <span className="frm-sr">, {STATUS_WORD[st]}</span>
        </a>
      );
    });
  const more = items('more');
  const ready = readiness(state, clockIn(ctx.timeZone));
  return (
    <nav className="frm-rail" aria-label="Sections of the form">
      {top && <div className="frm-rail-railseg">{top}</div>}
      {presets.length > 0 && (
        <div className="frm-rail-group">
          <span className="frm-eyebrow">Start from</span>
          <PresetSlot id={`frm-${scope}preset`} schema={schema} state={state} presets={presets} onApply={onApplyPreset} />
        </div>
      )}
      <div className="frm-rail-index">
        <span className="frm-eyebrow">Essentials</span>
        {items('essentials')}
        {more.length > 0 && (
          <>
            <span className="frm-eyebrow" data-at="more">
              More
            </span>
            {more}
          </>
        )}
      </div>
      <p className="frm-ready" data-status={ready.status} role="status">
        <Icon name={READY_ICON[ready.status]} size={18} />
        <span>{ready.text}</span>
      </p>
    </nav>
  );
}
