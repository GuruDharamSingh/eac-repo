// Colours more than one site shares, declared ONCE (2026-11-21, owner: "one shared bronze, elktours' value").
// The CSS twin is shared-accents.css (the variables `--eac-accent-bronze` as an hsl triplet and `-hex`); a site's
// globals.css imports it and points its own --primary / --ring at it, and a site's Site style schema reads the
// triplet below as its default. Keep the two files in step: scripts/check-shared-accents.mts fails when they drift.
// Plain data, no imports: safe for the editor (browser) and the layout (server) alike.

export const SHARED_ACCENTS = {
  /** elktours' brass, now also sunjay's bronze. hsl is the bare shadcn triplet; hex is its #rrggbb twin. */
  bronze: { hsl: "40 50% 57%", hex: "#c8a45b" },
} as const;
