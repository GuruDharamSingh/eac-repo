'use client';

import * as React from 'react';
import type { Answers } from '../contract';
import { Textarea } from './Input';

// ============================================================================
// "Add a note" under a section's dropdown (rows layout, 2026-11-15).
// Answer key `section_notes`: [{ section, label, text }] in schema order; plain text,
// each text trimmed, at most 1000 characters; an empty text removes the entry.
// The textarea keeps what is typed (trailing spaces included) in local state and
// writes the trimmed text, so typing a space between words is not eaten.
// ============================================================================

export const SECTION_NOTE_MAX = 1000;

export interface SectionNoteEntry {
  section: string;
  label: string;
  text: string;
}

/** The stored notes, read defensively (an array of well-formed entries). */
export function sectionNotesOf(a: Answers): SectionNoteEntry[] {
  const v = a.section_notes;
  if (!Array.isArray(v)) return [];
  return v.filter(
    (n): n is SectionNoteEntry =>
      !!n && typeof n === 'object' && typeof (n as SectionNoteEntry).section === 'string' && typeof (n as SectionNoteEntry).text === 'string'
  );
}

export function noteOf(a: Answers, section: string): string {
  return sectionNotesOf(a).find((n) => n.section === section)?.text ?? '';
}

/** The array with `section`'s note set (or removed when empty), other entries kept, in `order` (section ids). */
export function withNote(a: Answers, order: string[], section: string, label: string, raw: string): SectionNoteEntry[] {
  const text = raw.trim().slice(0, SECTION_NOTE_MAX).trim();
  const rest = sectionNotesOf(a).filter((n) => n.section !== section);
  const next = text ? [...rest, { section, label, text }] : rest;
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  return next.sort((x, y) => rank(x.section) - rank(y.section));
}

export function SectionNote({
  id,
  section,
  label,
  answers,
  order,
  patch,
}: {
  id: string;
  section: string;
  label: string;
  answers: Answers;
  order: string[];
  patch: (fields: Partial<Answers>) => void;
}) {
  const stored = noteOf(answers, section);
  const [draft, setDraft] = React.useState(stored);
  const [adding, setAdding] = React.useState(false);
  // A change from outside (a preset, a reload) replaces the draft; typing keeps it.
  React.useEffect(() => {
    if (stored !== draft.trim()) setDraft(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);

  // "+ Add a note" is replaced by the textarea: move focus into it, or focus falls to the page and a
  // following Escape closes the surrounding dialog instead of the row (rendered 2026-11-15).
  React.useEffect(() => {
    if (adding) document.getElementById(`${id}-note`)?.focus();
  }, [adding, id]);

  const write = (raw: string) => patch({ section_notes: withNote(answers, order, section, label, raw) });
  const shown = adding || stored !== '';
  if (!shown) {
    return (
      <button type="button" className="frm-note-add" onClick={() => setAdding(true)}>
        + Add a note
      </button>
    );
  }
  return (
    <div className="frm-note">
      <label className="frm-note-label" htmlFor={`${id}-note`}>
        Note for the page
      </label>
      <Textarea
        id={`${id}-note`}
        rows={3}
        maxLength={SECTION_NOTE_MAX}
        value={draft}
        aria-describedby={`${id}-note-hint`}
        onChange={(e) => {
          setDraft(e.target.value);
          write(e.target.value);
        }}
      />
      <span className="frm-note-hint" id={`${id}-note-hint`}>
        Shown under More details on the page
      </span>
      <button
        type="button"
        className="frm-note-remove"
        onClick={() => {
          setDraft('');
          setAdding(false);
          write('');
        }}
      >
        Remove note
      </button>
    </div>
  );
}
