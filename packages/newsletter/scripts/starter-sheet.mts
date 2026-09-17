/**
 * The nine starters, side by side, in the NEUTRAL palette.
 *
 *   pnpm --filter @elkdonis/newsletter preview:starters
 *
 * Neutral on purpose: these are what an org that has chosen nothing gets, and
 * the question worth looking at is whether the LAYOUT holds up without a brand
 * carrying it.
 */
import fs from "node:fs";
import { STARTER_LETTERS, renderStarter } from "../src/starters";
import { NEUTRAL_PALETTE as P, paletteFor } from "../src/blocks";

const ACCENT = paletteFor({ accent: "#7a1f3d" });
const which = process.argv[2] === "accent" ? ACCENT : P;
const out = process.argv[2] === "accent" ? "/tmp/starters-accent.html" : "/tmp/starters.html";

const cards = STARTER_LETTERS.map(
  (s) => `
<div class="col">
  <h2>${s.label}<span>${s.blocks.length} blocks</span></h2>
  <p class="hint">${s.hint}</p>
  <p class="chain">${s.blocks.map((b) => b.replace("eac-", "")).join(" › ")}</p>
  <div class="page">
    <div class="card">${renderStarter(s, which, "newsletter")}</div>
  </div>
</div>`
).join("");

fs.writeFileSync(
  out,
  `<!doctype html><html><head><meta charset="utf-8"><title>Starter layouts</title>
<style>
  body{margin:0;background:#101014;color:#e8e8ea;font:14px/1.6 ui-sans-serif,-apple-system,Segoe UI,sans-serif;padding:30px}
  h1{font-size:21px;margin:0 0 4px}
  .lede{color:#8b8b95;margin:0 0 26px;max-width:80ch}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}
  .col h2{font-size:14px;margin:0 0 3px;display:flex;justify-content:space-between;align-items:baseline;gap:10px}
  .col h2 span{font-size:11px;color:#6f6f7a;font-weight:400}
  .hint{margin:0 0 5px;font-size:12.5px;color:#8b8b95}
  .chain{margin:0 0 10px;font:11px/1.5 ui-monospace,Menlo,monospace;color:#5d6b8a}
  .page{background:${which.bodyBg};padding:16px;border:1px solid #26262e;height:660px;overflow:hidden}
  .card{max-width:600px;margin:0 auto;background:${which.cardBg};padding:26px 30px;font-family:${which.bodyFont}}
</style></head><body>
<h1>Nine starter layouts</h1>
<p class="lede">Each is a list of block ids, rendered through the same block table the editor offers &mdash;
so the layout and "the blocks it is made of" are the same thing. Shown in the ${
    process.argv[2] === "accent" ? "palette of an org that chose one colour (#7a1f3d)" : "neutral palette: no organisation's brand"
  }. Tops only; these are tall.</p>
<div class="grid">${cards}</div>
</body></html>`
);
console.log("wrote", out);
