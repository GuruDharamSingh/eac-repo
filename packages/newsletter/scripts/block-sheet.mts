/**
 * Every block, drawn inside the letter it will live in.
 *
 *   pnpm --filter @elkdonis/newsletter preview:blocks
 *
 * A block previewed on white tells you nothing — the whole library is coloured
 * for a dark card, and the only useful question is how the pieces look NEXT to
 * each other at 600px. So this renders the real shell around them.
 */
import fs from "node:fs";
import { BLOCKS_FOR_CHECK, DARK_BLOCK_PALETTE } from "../src/blocks";

const p = DARK_BLOCK_PALETTE;
const mode = "newsletter" as const;

const label = (id: string, text: string) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:34px 0 6px;">
  <tr><td style="font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6d6552;border-bottom:1px solid #2b3352;padding-bottom:4px;">
    ${text} <span style="color:#3f4a6d;">${id}</span>
  </td></tr>
</table>`;

const NEW = new Set([
  "eac-issue-head", "eac-feature", "eac-contents", "eac-quote",
  "eac-agenda", "eac-gallery", "eac-cta-panel", "eac-signoff", "eac-spacer",
]);

const body = BLOCKS_FOR_CHECK.filter((b) => !b.only || b.only.includes(mode))
  .map((b) => label(b.id, NEW.has(b.id) ? "new" : "existing") + b.content(p, mode))
  .join("\n");

fs.writeFileSync(
  "/tmp/block-sheet.html",
  `<!doctype html><html><head><meta charset="utf-8">
<style>
@font-face{font-family:'Brothers';src:url('https://elkdonis-arts.org/fonts/BrothersTypeface-Regular.otf') format('opentype')}
@font-face{font-family:'Basteleur';src:url('https://elkdonis-arts.org/fonts/Basteleur-Moonlight.woff2') format('woff2')}
@font-face{font-family:'Basteleur';src:url('https://elkdonis-arts.org/fonts/Basteleur-Bold.woff2') format('woff2');font-weight:700}
</style></head>
<body style="margin:0;background:${p.bodyBg};font-family:${p.bodyFont};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:36px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${p.cardBg};border:1px solid ${p.gold};">
        <tr><td style="padding:34px 40px 40px;">${body}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
);
console.log("wrote /tmp/block-sheet.html —", BLOCKS_FOR_CHECK.length, "blocks");
