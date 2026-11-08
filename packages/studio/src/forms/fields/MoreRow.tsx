'use client';

import * as React from 'react';
import { Icon } from '../theme/context';
import type { FieldTone } from './Field';

// ============================================================================
// MoreRow: a collapsible section that shows its value while closed (design
// §2 "More row"). A full-width disclosure button (aria-expanded,
// aria-controls) in a heading, so the rows are reachable by heading too; the
// body is a labelled region that is inert while closed, so Tab never walks
// into hidden fields. Opens in 150ms ease-out (none under reduced motion).
// A closed row with a problem shows it in place of its summary.
// ============================================================================

export interface MoreRowProps {
  /** The section anchor (the alert summary and the rail link here). */
  id: string;
  name: React.ReactNode;
  summary?: React.ReactNode;
  /** Shown instead of the summary while the row is closed. */
  problem?: { tone: FieldTone; text: string } | null;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function MoreRow({ id, name, summary, problem, open, onToggle, children }: MoreRowProps) {
  const shownProblem = open ? null : problem;
  return (
    <div className="frm-more" id={id} data-open={open ? '' : undefined}>
      <h3 className="frm-more-h">
        <button
          type="button"
          className="frm-more-btn"
          id={`${id}-btn`}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={onToggle}
        >
          <Icon name={open ? 'minus' : 'plus'} size={13} className="frm-more-pm" />
          <span className="frm-more-name">{name}</span>
          {(shownProblem || summary) && (
            <span className="frm-more-sum" data-tone={shownProblem?.tone}>
              {shownProblem && <Icon name="warning" size={14} />}
              <span className="frm-more-sum-text">{shownProblem ? shownProblem.text : summary}</span>
            </span>
          )}
        </button>
      </h3>
      <div
        className="frm-more-body"
        id={`${id}-body`}
        role="region"
        aria-labelledby={`${id}-btn`}
        data-open={open ? '' : undefined}
        inert={!open}
      >
        <div className="frm-more-clip">
          <div className="frm-more-inner">{children}</div>
        </div>
      </div>
    </div>
  );
}
