'use client';

import * as React from 'react';
import type { FormIssue } from '../contract';
import { alertTitle, blocking } from '../state';
import { fieldAnchor, fieldId, sectionAnchor } from '../fields/ids';
import { Icon } from '../theme/context';

// ============================================================================
// The alert summary (design §7, 1h): shown once Publish has been pressed and
// something blocks. role="alert" so it is announced when it appears; each
// link goes to the field (opening its More row first) and puts focus in it.
// Publish itself stays enabled (the design: problems show only when pressed).
// ============================================================================

/** Scroll to a field (or its section) and focus its control, after a More row has had a frame to open. */
export function goToField(issue: Pick<FormIssue, 'fields' | 'section'>, scope = '') {
  const name = issue.fields[0];
  const run = () => {
    const wrap = (name && document.getElementById(fieldAnchor(name, scope))) || document.getElementById(sectionAnchor(issue.section, scope));
    if (!wrap) return;
    wrap.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const control =
      (name && (document.getElementById(fieldId(name, scope)) as HTMLElement | null)) ||
      wrap.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea, button, [tabindex]:not([tabindex="-1"])');
    control?.focus({ preventScroll: true });
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
}

export function AlertSummary({
  issues,
  saved,
  scope = '',
  onOpenSection,
}: {
  /** The issues shown now. */
  issues: FormIssue[];
  /** The draft was saved by the Publish press. */
  saved: boolean;
  scope?: string;
  onOpenSection: (id: string) => void;
}) {
  const blocks = blocking(issues);
  if (!blocks.length) return null;
  return (
    <div className="frm-alert" role="alert">
      <Icon name="error" size={22} />
      <div className="frm-alert-body">
        <p className="frm-alert-title">{alertTitle(issues)}</p>
        <ul className="frm-alert-links">
          {blocks.map((i) => (
            <li key={i.ruleId}>
              <a
                href={`#${i.fields[0] ? fieldAnchor(i.fields[0], scope) : sectionAnchor(i.section, scope)}`}
                onClick={(e) => {
                  e.preventDefault();
                  onOpenSection(i.section);
                  goToField(i, scope);
                }}
              >
                {i.short}
              </a>
            </li>
          ))}
        </ul>
        <p className="frm-alert-note">{saved ? 'Your draft is saved. Nothing has been sent.' : 'Nothing has been sent.'}</p>
      </div>
    </div>
  );
}
