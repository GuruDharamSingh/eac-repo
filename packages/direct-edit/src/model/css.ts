// A part's raw CSS override as an ordered list of declarations. The Advanced
// section edits one property at a time; the Code tab edits the whole text.
// Sanitising is the host's job (its server validator decides what survives);
// these helpers only parse and rewrite.

export type Decl = [string, string];

export function parseDecls(css: string | undefined | null): Decl[] {
  if (!css) return [];
  const out: Decl[] = [];
  for (const piece of css.split(";")) {
    const i = piece.indexOf(":");
    if (i < 0) continue;
    const p = piece.slice(0, i).trim().toLowerCase();
    const v = piece.slice(i + 1).trim();
    if (p && v) out.push([p, v]);
  }
  return out;
}

export const declsText = (d: Decl[], sep = "; ") => d.map(([k, v]) => `${k}: ${v}`).join(sep);

export function getDecl(css: string | undefined, prop: string): string | undefined {
  const hit = parseDecls(css).filter(([k]) => k === prop).pop();
  return hit?.[1];
}

/** Set (or with an empty value, remove) one property, keeping the others in order. */
export function setDecl(css: string | undefined, prop: string, value: string | undefined | null): string {
  const d = parseDecls(css).filter(([k]) => k !== prop);
  if (value != null && String(value).trim()) d.push([prop, String(value).trim()]);
  return declsText(d);
}

/** Declarations in `raw` that `sanitize` dropped (shown to the member, never kept quietly). */
export function droppedDecls(raw: string, sanitize: (css: string) => Decl[]): Decl[] {
  const kept = new Set(sanitize(raw).map(([k]) => k));
  return parseDecls(raw).filter(([k]) => !kept.has(k));
}
