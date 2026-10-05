/**
 * Compound and layer keys a claim carries without being tagged with them
 * (Justin's attribute layering, 2026-10-04). Pure: shared by the importer
 * (import-chunker.ts writes them with every import) and the backfill
 * (scripts/derive-compounds.ts) so the two always agree.
 *
 *   placement:<body>:<sign>:<house>  the claim is tagged sign:<body>:<sign>
 *                                    AND house:<body>:<house> (one object:
 *                                    "Mars in Virgo in the 1st house")
 *   sign-house:<sign>:<house>        tagged zodiac:<sign> AND realm:<house>
 *   element: / modality: / polarity: the claim's own words name the layer as
 *                                    a class ("fire signs", "the water
 *                                    element", "mutable signs", "masculine
 *                                    signs") — not every passing "fire".
 *
 * Derived rows are written with role 'derived' so they can always be told
 * apart from what the digest itself tagged.
 */

import { isFactorKey } from "./factors";

const ELEMENT_RE = /\b(fire|earth|air|water)(?:y)?\s+(?:signs?|element|elements|triplicity|triplicities|types?|people|natives)\b|\bthe\s+(fire|earth|air|water)\s+element\b|\belement\s+of\s+(fire|earth|air|water)\b/gi;
const MODALITY_RE = /\b(cardinal|fixed|mutable)\s+(?:signs?|quality|qualities|modes?|modality|cross|quadruplicity|types?)\b/gi;
const POLARITY_RE = /\b(masculine|feminine|positive|negative|yang|yin)\s+(?:signs?|polarity)\b/gi;
const POLARITY_OF: Record<string, string> = { masculine: "masculine", positive: "masculine", yang: "masculine", feminine: "feminine", negative: "feminine", yin: "feminine" };

/** Keys to add to a claim, given the keys it already has and (optionally) its text. Never repeats a key it has. */
export function deriveCompounds(keys: readonly string[], text?: string | null): string[] {
  const have = new Set(keys);
  const out = new Set<string>();
  const signs = new Map<string, string[]>(); // body -> signs
  const houses = new Map<string, string[]>(); // body -> houses
  const zodiac: string[] = [];
  const realm: string[] = [];
  for (const k of keys) {
    const p = k.split(":");
    if (p[0] === "sign" && p.length === 3) signs.set(p[1], [...(signs.get(p[1]) ?? []), p[2]]);
    else if (p[0] === "house" && p.length === 3) houses.set(p[1], [...(houses.get(p[1]) ?? []), p[2]]);
    else if (p[0] === "zodiac") zodiac.push(p[1]);
    else if (p[0] === "realm") realm.push(p[1]);
  }
  for (const [body, ss] of signs) for (const s of ss) for (const h of houses.get(body) ?? []) out.add(`placement:${body}:${s}:${h}`);
  for (const s of zodiac) for (const h of realm) out.add(`sign-house:${s}:${h}`);

  if (text) {
    for (const m of text.matchAll(ELEMENT_RE)) out.add(`element:${(m[1] ?? m[2] ?? m[3]).toLowerCase()}`);
    for (const m of text.matchAll(MODALITY_RE)) out.add(`modality:${m[1].toLowerCase()}`);
    for (const m of text.matchAll(POLARITY_RE)) out.add(`polarity:${POLARITY_OF[m[1].toLowerCase()]}`);
  }
  return [...out].filter((k) => !have.has(k) && isFactorKey(k));
}
