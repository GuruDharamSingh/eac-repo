'use client';

import * as React from 'react';
import { Icon } from '../theme/context';
import { describedBy, fieldAnchor } from './ids';

// ============================================================================
// Field: the frame every control sits in (design §2 "Field", 1i states).
//
//   label (14/600, 13/600 as `sub`) · inline hint · "from preset X" tag
//   the control
//   the problem message (error: danger ink + icon; warning: strong ink, warn icon)
//   the hint below (12/1.45 muted)
//
// "Set by the series" (`locked`) fades label and control to 45% and offers the
// way to change it for this one. The control itself gets aria-invalid and
// aria-describedby from `fieldAria()`, so the message and hint are read with it.
// ============================================================================

export type FieldTone = 'error' | 'warning';

export interface FieldProblem {
  tone: FieldTone;
  /** Shown under the control; null marks the control without a message (a rule's second field). */
  message: string | null;
}

export interface FieldLock {
  /** "Change for this session". */
  label?: string;
  onUnlock?: () => void;
}

export interface FieldProps {
  /** The control's id (label htmlFor; message and hint ids derive from it). */
  id: string;
  /** The field name, for the anchor the alert summary links to. */
  name?: string;
  scope?: string;
  label?: React.ReactNode;
  /** The label is read but not drawn (the headline title, a More row's single field). */
  labelHidden?: boolean;
  /** For controls that are not labelable (a radiogroup): the label is a span the group points at. */
  labelAsText?: boolean;
  size?: 'section' | 'sub';
  inlineHint?: React.ReactNode;
  hint?: React.ReactNode;
  problem?: FieldProblem | null;
  /** The preset that filled this field; cleared by the state when it is edited. */
  fromPreset?: string | null;
  locked?: FieldLock | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** The ids a control should point at, for the same props Field is given. */
export function fieldAria(p: Pick<FieldProps, 'id' | 'hint' | 'problem' | 'fromPreset'>): {
  'aria-describedby'?: string;
  'aria-invalid'?: true;
} {
  const hasHint = Boolean(p.hint) || Boolean(p.fromPreset);
  return {
    'aria-describedby': describedBy(p.problem?.message && `${p.id}-msg`, hasHint && `${p.id}-hint`),
    'aria-invalid': p.problem?.tone === 'error' ? true : undefined,
  };
}

export function Field({
  id,
  name,
  scope,
  label,
  labelHidden,
  labelAsText,
  size = 'section',
  inlineHint,
  hint,
  problem,
  fromPreset,
  locked,
  required,
  className,
  children,
}: FieldProps) {
  const labelId = `${id}-label`;
  const showHead = Boolean(label) && !labelHidden;
  const hintText = hint ?? (fromPreset ? 'Change it here, for this one only.' : null);
  const labelInner = (
    <>
      {label}
      {required && <span className="frm-sr"> (required)</span>}
    </>
  );

  return (
    <div
      className={className ? `frm-field ${className}` : 'frm-field'}
      id={name ? fieldAnchor(name, scope) : undefined}
      data-field={name}
      data-size={size}
      data-locked={locked ? '' : undefined}
    >
      {showHead ? (
        <div className="frm-field-head">
          {labelAsText ? (
            <span className="frm-label" id={labelId}>
              {labelInner}
            </span>
          ) : (
            <label className="frm-label" id={labelId} htmlFor={id}>
              {labelInner}
            </label>
          )}
          {fromPreset && (
            <span className="frm-tag frm-tag--neutral">
              <Icon name="preset" size={12} />
              {fromPreset}
            </span>
          )}
          {inlineHint && <span className="frm-label-hint">{inlineHint}</span>}
        </div>
      ) : label ? (
        labelAsText ? (
          <span className="frm-sr" id={labelId}>
            {labelInner}
          </span>
        ) : (
          <label className="frm-sr" id={labelId} htmlFor={id}>
            {labelInner}
          </label>
        )
      ) : null}

      <div className="frm-field-control">{children}</div>

      {problem?.message && (
        <p className="frm-msg" data-tone={problem.tone} id={`${id}-msg`}>
          <Icon name={problem.tone === 'error' ? 'error' : 'warning'} size={16} />
          <span>{problem.message}</span>
        </p>
      )}
      {hintText && (
        <p className="frm-hint" id={`${id}-hint`}>
          {hintText}
        </p>
      )}
      {locked && (
        <button type="button" className="frm-unlock" onClick={locked.onUnlock} disabled={!locked.onUnlock}>
          {locked.label ?? 'Change for this one'}
        </button>
      )}
    </div>
  );
}
