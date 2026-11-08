// ============================================================================
// Hydration-safe ids (PLAN §1.4, a1): every id in the forms comes from a field
// name or a section id, never useId() or a random value, so the server and the
// client print the same markup. One form per page is the assumption; a host
// that draws two passes a distinct `scope` to the shell.
// ============================================================================

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

/** The control itself (the <input>, <select>, <textarea>, the first radio). */
export function fieldId(name: string, scope = ''): string {
  return `frm-${scope ? `${slug(scope)}-` : ''}f-${slug(name)}`;
}

/** The field's wrapper: what the alert summary links to. */
export function fieldAnchor(name: string, scope = ''): string {
  return `frm-${scope ? `${slug(scope)}-` : ''}fw-${slug(name)}`;
}

/** A section's anchor (essentials block or More row). */
export function sectionAnchor(id: string, scope = ''): string {
  return `frm-${scope ? `${slug(scope)}-` : ''}s-${slug(id)}`;
}

/** Space-joined ids for aria-describedby, or undefined when there are none. */
export function describedBy(...ids: Array<string | false | null | undefined>): string | undefined {
  const s = ids.filter(Boolean).join(' ');
  return s || undefined;
}
