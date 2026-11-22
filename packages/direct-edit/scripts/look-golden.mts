// One-off: writes look-golden.json from the CURRENT compiler. It was run once, on 2026-11-20, before lane LOOK
// changed morph.ts, so the file records what a stored v1 morph compiled to before states and sizes existed.
// Re-running it after that change would only record the new output; do not.
import React from "react";
(globalThis as any).React = React;
import { writeFileSync } from "node:fs";
const { cleanMorph, morphCss } = await import("/app/packages/direct-edit/src/block/morph.ts");
const { FIXTURES, PARTS } = await import("./look-fixtures.mts");

const out: Record<string, unknown> = {};
for (const f of FIXTURES) {
  const parts = "parts" in f ? f.parts : PARTS;
  const clean = cleanMorph(f.morph);
  out[f.name] = {
    clean: clean ? JSON.stringify(clean) : null,
    pub: clean ? morphCss(clean, parts as any, {}) : null,
    editor: clean ? morphCss(clean, parts as any, { editor: true }) : null,
  };
}
writeFileSync(new URL("./look-golden.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log("wrote", Object.keys(out).length, "fixtures");
