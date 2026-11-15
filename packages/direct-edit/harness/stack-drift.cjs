// The layer stack exists twice (2026-11-14, inception): packages/direct-edit/src/canvas/stack.ts and
// packages/page-builder/src/layer-stack.ts, because neither package imports the other. Both must read and write the
// same registry the same way, so everything below each file's header block must be byte-identical.
// Run: node packages/direct-edit/harness/stack-drift.cjs   (exit 1 on drift)
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "../../..");
const body = (rel) => {
  const s = fs.readFileSync(path.join(root, rel), "utf8");
  const end = s.indexOf("// ============================================================================", 1);
  if (end < 0) throw new Error(`${rel}: no header block`);
  return s.slice(s.indexOf("\n", end) + 1);
};
const a = body("packages/direct-edit/src/canvas/stack.ts"), b = body("packages/page-builder/src/layer-stack.ts");
if (a === b) { console.log(`stack-drift: identical (${a.length} bytes below the header)`); process.exit(0); }
console.log("stack-drift: the two layer-stack files differ below their headers"); process.exit(1);
