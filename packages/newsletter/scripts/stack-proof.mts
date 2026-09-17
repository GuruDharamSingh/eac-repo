/**
 * The two multi-column blocks, alone, so the stacking can be seen at two widths.
 */
import fs from "node:fs";
import { BLOCKS_FOR_CHECK, DARK_BLOCK_PALETTE as p } from "../src/blocks";

const pick = (id: string) =>
  BLOCKS_FOR_CHECK.find((b) => b.id === id)!.content(p, "newsletter");

fs.writeFileSync(
  "/tmp/stack-proof.html",
  `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:${p.bodyBg};font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;background:${p.cardBg};border:1px solid ${p.gold};">
    <div style="padding:38px 40px;">
      <div style="font:11px/1.6 monospace;letter-spacing:.14em;color:#6d6552;padding-bottom:6px;">PICTURE ROW</div>
      ${pick("eac-gallery")}
      <div style="font:11px/1.6 monospace;letter-spacing:.14em;color:#6d6552;padding:18px 0 6px;">TWO COLUMNS</div>
      ${pick("eac-two-column")}
    </div>
  </div>
</body></html>`
);
console.log("wrote /tmp/stack-proof.html");
