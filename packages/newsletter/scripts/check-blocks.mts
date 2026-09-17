/**
 * Every block, against what email clients actually allow.
 *
 *   pnpm --filter @elkdonis/newsletter check:blocks
 *
 * A block that uses flex, or an <img> with no width, or a colour only in a
 * class, looks correct in the studio and arrives broken. These are the rules
 * the whole library exists to obey, so they are worth asserting rather than
 * remembering.
 */
import {
  BLOCKS_FOR_CHECK,
  DARK_BLOCK_PALETTE,
  LIGHT_BLOCK_PALETTE,
  NEUTRAL_PALETTE,
  NEUTRAL_DARK_PALETTE,
  paletteFor,
} from "../src/blocks";

let failed = 0;
const fail = (id: string, why: string) => {
  console.log(`FAIL  ${id.padEnd(18)} ${why}`);
  failed += 1;
};

// Four grounds, not two. The InnerGathering pair is one org's look; the
// neutral pair is what an org that has chosen nothing gets; and a derived
// palette is what one that has chosen a single colour gets. A block that only
// holds up in navy-and-gold is not a network block.
const PALETTES = [
  DARK_BLOCK_PALETTE,
  LIGHT_BLOCK_PALETTE,
  NEUTRAL_PALETTE,
  NEUTRAL_DARK_PALETTE,
  paletteFor({ accent: "#7a1f3d" }),
  paletteFor({ accent: "#e8d44d", ground: "dark" }),
];

for (const palette of PALETTES) {
  for (const mode of ["newsletter", "template"] as const) {
    for (const block of BLOCKS_FOR_CHECK) {
      if (block.only && !block.only.includes(mode)) continue;
      const html = block.content(palette, mode).trim();
      const id = block.id;

      // Layout: tables only. Word has no flex, no grid, no float-based columns.
      for (const banned of ["display:flex", "display:grid", "display: flex", "display: grid", "position:absolute", "aspect-ratio"]) {
        if (html.includes(banned)) fail(id, `uses ${banned}`);
      }

      // Every image needs an explicit width attribute or Outlook sizes it at
      // its intrinsic pixel size, which for a 2000px photo means a 2000px email.
      for (const img of html.match(/<img[^>]*>/g) ?? []) {
        if (!/\swidth="\d+"/.test(img)) fail(id, "an <img> has no width attribute");
        if (!/\salt=/.test(img)) fail(id, "an <img> has no alt attribute");
      }

      // A gradient with no solid colour under it renders as nothing in Word.
      if (/linear-gradient/.test(html) && !/background-color:/.test(html)) {
        fail(id, "gradient with no background-color fallback");
      }

      // Styling has to be inline: a class selector is stripped or ignored.
      if (/class="/.test(html)) fail(id, "uses a class attribute");

      // No colour may be hardcoded. A literal hex in a block is one org's
      // brand smuggled into a shared layout — which is exactly what the two
      // filled buttons were doing with InnerGathering's navy.
      // Only inside a style declaration. A bare "#0000-0000" in the body is
      // an order reference, not a colour, and the first version of this check
      // failed the receipt block ten times over for it.
      const declared = [...html.matchAll(/(?:color|background|background-color|border[a-z-]*)\s*:\s*([^;"']*)/gi)]
        .flatMap((m) => m[1].match(/#[0-9a-fA-F]{3,8}/g) ?? []);
      for (const lit of declared) {
        const fromPalette = Object.values(palette).some(
          (v) => typeof v === "string" && v.toLowerCase() === lit.toLowerCase()
        );
        // Black and white are the two the contrast pairing is allowed to pick.
        const derived = ["#000000", "#ffffff", "#fff", "#000"].includes(lit.toLowerCase());
        if (!fromPalette && !derived) fail(id, `hardcodes the colour ${lit}`);
      }

      // Layout tables must announce themselves, or a screen reader reads the
      // letter as a data table.
      for (const table of html.match(/<table[^>]*>/g) ?? []) {
        if (!/role="presentation"/.test(table)) fail(id, "a <table> is missing role=presentation");
      }

      // A link with no href is a dead word in an inbox.
      for (const a of html.match(/<a[^>]*>/g) ?? []) {
        if (!/\shref="/.test(a)) fail(id, "an <a> has no href");
      }

      if (html.length === 0) fail(id, "renders nothing");

      // Multi-column blocks must carry BOTH halves of the hybrid pattern, or
      // they silently regress: without the inline-block trio they stay three
      // 90px thumbnails on a phone, and without the conditionals Outlook
      // stacks everything into one column.
      const MULTI = ["eac-gallery", "eac-two-column"];
      if (MULTI.includes(id)) {
        if (!/display:inline-block/.test(html)) fail(id, "multi-column but no inline-block columns");
        if (!/min-width:\d+px/.test(html) || !/max-width:\d+px/.test(html)) {
          fail(id, "multi-column but missing the min/max pair that makes it wrap");
        }
        if (!/\[if mso\]/.test(html)) fail(id, "multi-column but no Outlook conditional table");
        if (!/font-size:0/.test(html)) {
          fail(id, "inline-block columns with no font-size:0 parent — source whitespace will push the last column down");
        }
        // `max-width` is what holds the columns side by side; `min-width` is a
        // readability floor UNDER it. Inverted, every column pins to the floor
        // and the row overflows — which is exactly what happened the first
        // time this was written, and why the check says which is which.
        const min = Number(/min-width:(\d+)px/.exec(html)?.[1] ?? 0);
        const max = Number(/max-width:(\d+)px/.exec(html)?.[1] ?? 0);
        if (min > max) {
          fail(id, `min-width ${min} is above max-width ${max} — columns pin to the floor and overflow`);
        }
        // They have to FIT: the card gives 520px of content (600 less 40 each
        // side), so a row whose caps sum past that wraps on a desktop too.
        const columns = (html.match(/display:inline-block/g) ?? []).length;
        if (columns * max > 520) {
          fail(id, `${columns} columns capped at ${max}px need ${columns * max}px; the card has 520`);
        }
      }
    }
  }
}

const n = BLOCKS_FOR_CHECK.length;
console.log(
  failed === 0
    ? `\nall ${n} blocks are email-safe across ${PALETTES.length} palettes and both modes`
    : `\n${failed} problem(s) across ${n} blocks`
);
if (failed > 0) process.exitCode = 1;
