/**
 * The starters hold together.
 *
 *   pnpm --filter @elkdonis/newsletter check:starters
 *
 * A starter is a list of block ids, which means it can go wrong in exactly two
 * ways that no type catches: naming a block that does not exist, and naming one
 * the document excludes. Both produce a layout that silently renders short.
 */
import {
  STARTER_LETTERS,
  renderStarter,
  unknownStarterBlocks,
  starterModeConflicts,
} from "../src/starters";
import { NEUTRAL_PALETTE, NEUTRAL_DARK_PALETTE, paletteFor } from "../src/blocks";

let failed = 0;
const fail = (what: string) => {
  console.log("FAIL  " + what);
  failed += 1;
};

for (const { starter, missing } of unknownStarterBlocks()) {
  fail(`${starter} names blocks that do not exist: ${missing.join(", ")}`);
}
for (const { starter, block } of starterModeConflicts()) {
  fail(`${starter} uses ${block}, which its mode does not register`);
}

const PALETTES = [
  ["neutral", NEUTRAL_PALETTE],
  ["neutral dark", NEUTRAL_DARK_PALETTE],
  ["a chosen colour", paletteFor({ accent: "#7a1f3d" })],
] as const;

for (const s of STARTER_LETTERS) {
  const modes = s.only ?? (["newsletter", "template"] as const);
  let bytes = 0;
  for (const [, palette] of PALETTES) {
    for (const mode of modes) {
      const html = renderStarter(s, palette, mode);
      bytes = Math.max(bytes, html.length);
      if (!html.trim()) fail(`${s.id} renders nothing in ${mode}`);
      // A starter that lost blocks to a filter is shorter than its own list.
      const rendered = (html.match(/<table/g) ?? []).length;
      if (rendered < s.blocks.length) {
        fail(`${s.id} rendered ${rendered} tables for ${s.blocks.length} blocks`);
      }
    }
  }
  console.log(
    `${failed === 0 ? "ok  " : "    "}  ${s.id.padEnd(14)} ${String(s.blocks.length).padStart(2)} blocks · ${bytes} bytes · ${s.blocks.join(" → ")}`
  );
}

console.log(
  failed === 0
    ? `\nall ${STARTER_LETTERS.length} starters compose cleanly`
    : `\n${failed} problem(s)`
);
if (failed > 0) process.exitCode = 1;
