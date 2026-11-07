// On-demand loading in the browser. Pages ship only the fonts they use (one
// stylesheet from googleFontsHref, rendered by the server); editors call these
// as a member browses or picks fonts. One <link> per family, so a single bad
// request cannot take the others down. No-ops on the server.

import { fontEntry } from "./library";
import { GOOGLE_CSS, googleFamilyParam } from "./google";

const loaded = new Map<string, "preview" | "full">();

function addLink(href: string) {
  if (typeof document === "undefined") return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  l.dataset.fontLoader = "1";
  document.head.appendChild(l);
}

/** Load every weight and italic of a library family (for real use). */
export function loadFont(family: string): void {
  const e = fontEntry(family);
  if (!e || e.source !== "google" || loaded.get(family) === "full") return;
  loaded.set(family, "full");
  addLink(`${GOOGLE_CSS}?family=${googleFamilyParam(e)}&display=swap`);
}

/** Load just the family's regular face, enough to draw its name in a picker. */
export function previewFont(family: string): void {
  const e = fontEntry(family);
  if (!e || e.source !== "google" || loaded.has(family)) return;
  loaded.set(family, "preview");
  addLink(`${GOOGLE_CSS}?family=${googleFamilyParam(e, { weights: [400], italics: false })}&display=swap`);
}

export function loadFonts(families: Iterable<string | undefined | null>): void {
  for (const f of families) if (f) loadFont(f);
}
