// One-off (lane LIVE, 2026-11-20): writes look-golden-states.json from the compiler AS IT WAS before lane LIVE added
// the editor-only "force a state / size" selectors. The check proves `morphCss(..., { editor: false })` for looks with
// states and screen sizes is byte-identical afterwards. Run once, before the change; re-running it afterwards would
// only record the new output.
import React from "react";
(globalThis as any).React = React;
import { writeFileSync } from "node:fs";
const { cleanMorph, morphCss } = await import("/app/packages/direct-edit/src/block/morph.ts");
const { PARTS } = await import("./look-fixtures.mts");

export const STATE_FIXTURES: Array<{ name: string; morph: unknown }> = [
  { name: "hover on the title", morph: { v: 1, parts: { title: { size: 30, states: { hover: { fill: "#cc0000", color: "#ffffff" } } } } } },
  { name: "focus and active on the button", morph: { v: 1, parts: { cta: { fill: "#00a", states: { focus: { bcolor: "#0a0", bwidth: 3, bstyle: "solid" }, active: { opacity: 0.6 } } } } } },
  { name: "all three states on the root", morph: { v: 1, parts: { root: { radius: 6, states: { hover: { fill: "#eee" }, focus: { fill: "#ddd" }, active: { fill: "#ccc" } } } } } },
  { name: "phones and tablets on the title", morph: { v: 1, parts: { title: { size: 40, at: { md: { size: 30 }, sm: { size: 20 } } } } } },
  { name: "hide on phones", morph: { v: 1, parts: { media: { at: { sm: { hide: true } } }, cta: { at: { sm: { w: 100 } } } } } },
  { name: "state and size on different parts", morph: { v: 1, parts: { title: { states: { hover: { color: "#c00" } } }, body: { at: { sm: { size: 14 } } } } } },
  { name: "a state of a part with a pseudo-element selector", morph: { v: 1, parts: { x: { states: { hover: { fill: "#fff" } } } } } },
  { name: "tokens with states and sizes", morph: { v: 1, tokens: { "--blk-accent": "#a33" }, parts: { title: { size: 30, states: { hover: { fill: "#fee" } }, at: { sm: { size: 22 } } } } } },
  { name: "a state of a part the block does not declare", morph: { v: 1, parts: { ghost: { states: { hover: { fill: "#fff" } } }, title: { size: 20 } } } },
  { name: "a font in a state", morph: { v: 1, parts: { title: { states: { hover: { font: "Lora" } }, at: { sm: { font: "Lora" } } } } } },
];
export const STATE_PARTS = { ...PARTS, x: { sel: "> p::first-line" } };

if (process.argv[1]?.endsWith("look-golden-states.mts")) {
  const out: Record<string, unknown> = {};
  for (const f of STATE_FIXTURES) {
    const clean = cleanMorph(f.morph);
    out[f.name] = { clean: clean ? JSON.stringify(clean) : null, pub: clean ? morphCss(clean, STATE_PARTS as any, {}) : null, pubExplicitFalse: clean ? morphCss(clean, STATE_PARTS as any, { editor: false }) : null };
  }
  writeFileSync(new URL("./look-golden-states.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
  console.log("wrote", Object.keys(out).length, "fixtures");
}
