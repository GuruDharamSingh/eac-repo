'use client';

// ============================================================================
// Canvas id 1i: the field states every kind shares, drawn with the real field
// components (not pictures of them): empty, focused, filled with a hint,
// error, warning, from a preset, set by the series, the closed More rows, and
// the main action's four looks.
// ============================================================================

import * as React from 'react';
import type { FormTheme } from '../contract';
import { Field, fieldAria, type FieldProblem } from '../fields/Field';
import { Input } from '../fields/Input';
import { MoreRow } from '../fields/MoreRow';
import { FormRoot, Icon } from '../theme/context';

function Cell({ title, tone, children }: { title: string; tone?: 'error'; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <span className="frm-eyebrow" style={tone ? { color: 'var(--frm-danger-ink)' } : undefined}>
        {title}
      </span>
      {children}
    </div>
  );
}

export function StatesSheet({ theme }: { theme: FormTheme }) {
  const [place, setPlace] = React.useState('Studio 4');
  const err: FieldProblem = { tone: 'error', message: 'This date has passed. Pick a day from today on.' };
  const warn: FieldProblem = { tone: 'warning', message: 'More than the 10 places. It can never go ahead.' };
  const noop = () => undefined;
  return (
    <FormRoot theme={theme} style={{ minHeight: '100vh', padding: '32px 36px 36px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '30px 28px', maxWidth: 828 }}>
        <Cell title="Empty">
          <Field id="s-empty" label="Place">
            <Input id="s-empty" placeholder="An address or a room" value="" onChange={noop} />
          </Field>
        </Cell>
        <Cell title="Focused">
          <Field id="s-focus" label="Place">
            <Input id="s-focus" value={place} autoFocus onChange={(e) => setPlace(e.target.value)} />
          </Field>
        </Cell>
        <Cell title="Filled, with hint">
          <Field id="s-filled" label="Places" hint="Empty means no cap.">
            <Input id="s-filled" type="number" value="24" onChange={noop} {...fieldAria({ id: 's-filled', hint: 'Empty means no cap.' })} />
          </Field>
        </Cell>
        <Cell title="Error, blocks publishing" tone="error">
          <Field id="s-error" label="Starts" problem={err}>
            <Input id="s-error" type="date" icon="date" tone="error" value="2026-11-05" onChange={noop} {...fieldAria({ id: 's-error', problem: err })} />
          </Field>
        </Cell>
        <Cell title="Warning, still publishes">
          <Field id="s-warn" label="Needs at least" problem={warn}>
            <Input id="s-warn" type="number" tone="warning" value="12" onChange={noop} {...fieldAria({ id: 's-warn', problem: warn })} />
          </Field>
        </Cell>
        <Cell title="From a preset">
          <Field id="s-preset" label="Reminder" fromPreset="Thursday open studio">
            <Input id="s-preset" value="1 day before" onChange={noop} {...fieldAria({ id: 's-preset', fromPreset: 'x' })} />
          </Field>
        </Cell>
        <Cell title="Set by the series">
          <Field id="s-locked" label="Time" locked={{ label: 'Change for this session', onUnlock: noop }}>
            <Input id="s-locked" type="time" locked value="18:30" onChange={noop} />
          </Field>
        </Cell>
        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="frm-eyebrow" style={{ marginBottom: 6 }}>
            More rows: closed, closed with a problem
          </span>
          <div className="frm-more-list" style={{ paddingInline: 10 }}>
            <MoreRow id="s-more-a" name="Emails" summary="A reminder a day before" open={false} onToggle={noop}>
              {null}
            </MoreRow>
            <MoreRow
              id="s-more-b"
              name="Places and RSVP"
              summary="10 places · closes when it starts"
              problem={{ tone: 'warning', text: 'Needs 12 to go ahead, but only 10 places' }}
              open={false}
              onToggle={noop}
            >
              {null}
            </MoreRow>
          </div>
        </div>
        <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="frm-eyebrow">The main action</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            <button type="button" className="frm-btn frm-btn--primary">
              Publish
            </button>
            <button type="button" className="frm-btn frm-btn--primary">
              <Icon name="clock" size={16} />
              Schedule for Tue 10 Nov, 09:00
            </button>
            <button type="button" className="frm-btn frm-btn--primary" data-busy="" aria-busy>
              <Icon name="spinner" size={16} className="frm-spin" />
              Publishing…
            </button>
            <button type="button" className="frm-btn frm-btn--primary" disabled>
              Publish
            </button>
            <span className="frm-hint">Publish stays pressable until it is pressed, so the problems can be shown.</span>
          </div>
        </div>
      </div>
    </FormRoot>
  );
}
