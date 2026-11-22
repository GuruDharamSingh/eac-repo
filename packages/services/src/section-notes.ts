// Row notes ("extra copy", 2026-11-15): short plain-text notes a person adds under a form row (When,
// Where, Hosts, Places and RSVP), shown on the public page as "More details". Stored as the array
// `threads.metadata.sectionNotes`, in the form's order. Plain text only: readers render it as text.
// Validation lives here, at the services boundary, because this is what persists.

export interface SectionNote {
  /** The form section's id (`where`, `rsvp`, ...). */
  section: string;
  /** The row's name, kept so the public page does not need the form's schema. */
  label: string;
  text: string;
}

export const SECTION_NOTE_LIMITS = { entries: 12, text: 1000, label: 40 } as const;
const SECTION_ID = /^[a-z][a-zA-Z0-9-]{0,39}$/;

/**
 * Checks and cleans an array of notes: text and label are trimmed, entries with empty text are dropped.
 * Returns the cleaned array (empty = remove the key) or the refusal.
 */
export function cleanSectionNotes(input: unknown): { ok: true; value: SectionNote[] } | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, value: [] };
  if (!Array.isArray(input)) return { ok: false, error: 'Notes must be a list.' };
  const out: SectionNote[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'A note is not valid.' };
    const { section, label, text } = raw as Record<string, unknown>;
    if (typeof section !== 'string' || !SECTION_ID.test(section)) return { ok: false, error: 'A note names a row that does not exist.' };
    if (typeof text !== 'string' || (label !== undefined && typeof label !== 'string')) return { ok: false, error: 'A note is not valid.' };
    const t = text.replace(/\r\n?/g, '\n').trim();
    if (!t) continue;
    if (t.length > SECTION_NOTE_LIMITS.text) return { ok: false, error: `A note can be up to ${SECTION_NOTE_LIMITS.text} characters.` };
    const l = typeof label === 'string' ? (label as string).trim() : '';
    if (l.length > SECTION_NOTE_LIMITS.label) return { ok: false, error: `A note's label can be up to ${SECTION_NOTE_LIMITS.label} characters.` };
    if (seen.has(section)) return { ok: false, error: 'Each row can have one note.' };
    seen.add(section);
    out.push({ section, label: l, text: t });
  }
  if (out.length > SECTION_NOTE_LIMITS.entries) return { ok: false, error: `A page can have up to ${SECTION_NOTE_LIMITS.entries} notes.` };
  return { ok: true, value: out };
}

/** Reads stored notes defensively (for display): anything invalid is skipped, never thrown. */
export function readSectionNotes(stored: unknown): SectionNote[] {
  if (!Array.isArray(stored)) return [];
  const out: SectionNote[] = [];
  for (const raw of stored.slice(0, SECTION_NOTE_LIMITS.entries)) {
    if (!raw || typeof raw !== 'object') continue;
    const { section, label, text } = raw as Record<string, unknown>;
    if (typeof section !== 'string' || typeof text !== 'string' || !text.trim()) continue;
    out.push({ section, label: typeof label === 'string' && label.trim() ? label.trim() : section, text: text.trim() });
  }
  return out;
}
