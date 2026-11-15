'use client';

import * as React from 'react';
import type { FormTier } from '../contract';

// ============================================================================
// Title: the headline, first in Essentials (design §2). No box: heading font,
// --frm-title-size (34px; 27px on a phone; 23px in quick compose), caret in the
// accent. One textarea everywhere with `field-sizing: content`, so a long
// title wraps instead of scrolling sideways; Enter is swallowed and pasted
// line breaks become spaces, because a title is one line of text. Browsers
// without field-sizing get the height set from scrollHeight.
// ============================================================================

export interface TitleProps {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  tier?: FormTier;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
}

function fitsByCss(): boolean {
  try {
    return typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content');
  } catch {
    return false;
  }
}

export function Title({ id, value, onChange, placeholder = 'Title', label = 'Title', tier = 'focus', describedBy, invalid, disabled }: TitleProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || fitsByCss()) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      id={id}
      className="frm-title"
      rows={1}
      value={value}
      placeholder={placeholder}
      aria-label={label}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      data-tier={tier}
      disabled={disabled}
      spellCheck
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault();
      }}
      onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, ' '))}
    />
  );
}
