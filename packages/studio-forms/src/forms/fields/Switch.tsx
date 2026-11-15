'use client';

import * as React from 'react';

// ============================================================================
// Switch: a yes/no that opens something up (Repeats, Take RSVPs). A button
// with role="switch" and aria-checked; Space and Enter toggle it natively.
// The label names it; the summary ("Every week on Thursday, 8 sessions") is
// its description, so it is read after the state rather than as the name.
// ============================================================================

export interface SwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  summary?: React.ReactNode;
  describedBy?: string;
  disabled?: boolean;
}

export function Switch({ id, checked, onChange, label, summary, describedBy, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      className="frm-switch"
      aria-checked={checked}
      aria-labelledby={`${id}-name`}
      aria-describedby={[summary ? `${id}-sum` : '', describedBy ?? ''].filter(Boolean).join(' ') || undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="frm-switch-track" aria-hidden="true">
        <span className="frm-switch-knob" />
      </span>
      <span className="frm-switch-label" id={`${id}-name`}>
        {label}
      </span>
      {summary && (
        <span className="frm-switch-summary" id={`${id}-sum`}>
          {summary}
        </span>
      )}
    </button>
  );
}
