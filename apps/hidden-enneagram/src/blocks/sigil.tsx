import { defineBlock } from "@elkdonis/blocks";
import { AeonSigil } from "@/components/aeon/sigil";

// ============================================================================
// The figure as ornament (he-sigil, 2026-11-11): the drawn enneagram the Opening
// sets beside its words, as a block of its own. It exists so a page laid out as
// boxes in the canvas can hold the ornament: an SVG cannot be copied into boxes,
// so `lib/puck/boxify.ts` puts this block where the Opening drew it.
// Decorative only (aria-hidden). Id is stored in page JSON: never rename.
// ============================================================================

export function HeSigil() {
  return <AeonSigil />;
}

export const heSigil = defineBlock(
  {
    id: "he-sigil",
    label: "The figure (ornament)",
    category: "content",
    description: "The drawn enneagram as an ornament: no reader, no sound. Place it in a box beside words.",
    memberSafe: true,
    styling: "tokens",
    props: [] as const,
    parts: {},
    tokens: [
      { name: "--he-gut", label: "Gut centre", type: "color" },
      { name: "--he-heart", label: "Heart centre", type: "color" },
      { name: "--he-head", label: "Head centre", type: "color" },
    ],
  },
  HeSigil,
);
