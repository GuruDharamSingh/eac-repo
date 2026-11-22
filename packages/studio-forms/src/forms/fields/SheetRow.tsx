'use client';

import * as React from 'react';
import type { FieldTone } from './Field';

// ============================================================================
// SheetRow: one quick-form section as a row (the rows layout, 2026-11-15; boards
// ERows / WDrop). A full-width button: the label on the left, the section's value
// on the right (muted while it is a placeholder), a chevron. Pressing anywhere on
// the row opens a thin dropdown under it that holds the section's own body.
//
// The body stays mounted while closed (hidden + inert), so a section's local state
// (When's "Other" length) survives a close. Escape closes it and returns focus to
// the button; stopPropagation keeps a surrounding surface from closing too. A press
// outside the wrapper closes it. Focus stays on the button when it opens.
// A closed row with a problem shows the problem in place of the value, and a row
// whose problem appears opens itself (`onOpen`).
// ============================================================================

export interface SheetRowProps {
  /** The section anchor (the alert summary and the rail link here). */
  id: string;
  name: string;
  /** The section's value; empty means "show the placeholder". */
  value?: string;
  placeholder: string;
  problem?: { tone: FieldTone; text: string } | null;
  open: boolean;
  onToggle: () => void;
  /** Open this row (and, in the host, close the others). Called when a problem appears. */
  onOpen: () => void;
  onClose: () => void;
  /** The section has a note: a small mark follows the value. */
  noted?: boolean;
  /** Drawn at the bottom of the dropdown after a divider (the note control). */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function SheetRow({ id, name, value, placeholder, problem, open, onToggle, onOpen, onClose, noted, footer, children }: SheetRowProps) {
  const wrap = React.useRef<HTMLDivElement>(null);
  const btn = React.useRef<HTMLButtonElement>(null);
  const shownProblem = open ? null : problem;
  const problemText = problem?.text ?? '';

  // A problem that appears while the row is closed opens it (once per message).
  const onOpenRef = React.useRef(onOpen);
  onOpenRef.current = onOpen;
  const wasOpen = React.useRef(open);
  wasOpen.current = open;
  React.useEffect(() => {
    if (problemText && !wasOpen.current) onOpenRef.current();
  }, [problemText]);

  // A press outside the wrapper closes an open row.
  React.useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (wrap.current && e.target instanceof Node && !wrap.current.contains(e.target)) onClose();
    };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  }, [open, onClose]);

  // Open upward when the dropdown would end below the nearest scrolling box and there is room above:
  // inside the wide layout's size container (container-type: inline-size) a dropdown does not extend the
  // scroll area, so one opened downward from the last rail rows could not be scrolled to (rendered 2026-11-15).
  const [up, setUp] = React.useState(false);
  React.useLayoutEffect(() => {
    if (!open) {
      setUp(false);
      return;
    }
    const row = btn.current;
    const panel = wrap.current?.querySelector<HTMLElement>('.frm-srow-panel');
    if (!row || !panel) return;
    let box: HTMLElement | null = wrap.current?.parentElement ?? null;
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    const limit = box ? box.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const r = row.getBoundingClientRect();
    const h = panel.getBoundingClientRect().height;
    setUp(r.bottom + h > limit.bottom && r.top - limit.top > h);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    // preventDefault: a surrounding native <dialog> (cms-ui SurfaceProvider) closes on Escape's
    // default action (`cancel`), which stopPropagation alone does not stop (rendered 2026-11-15).
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation?.();
    onClose();
    btn.current?.focus();
  };

  const filled = Boolean(value);
  return (
    <div className="frm-srow" id={id} data-open={open ? '' : undefined} data-up={up ? '' : undefined} ref={wrap} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="frm-srow-btn"
        id={`${id}-btn`}
        ref={btn}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
      >
        <span className="frm-srow-name">{name}</span>
        <span className="frm-srow-val" data-state={shownProblem ? 'problem' : filled ? 'set' : 'empty'} data-tone={shownProblem?.tone}>
          {shownProblem ? shownProblem.text : filled ? value : placeholder}
          {noted && (
            <span className="frm-srow-note" aria-label="Has a note">
              ✎
            </span>
          )}
        </span>
        <span className="frm-srow-chev" aria-hidden="true">
          {open ? '˅' : '›'}
        </span>
      </button>
      <div className="frm-srow-panel" id={`${id}-panel`} role="group" aria-label={name} hidden={!open} inert={!open}>
        {children}
        {footer ? <div className="frm-srow-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
