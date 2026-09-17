// ============================================================================
// This site's own blocks.
//
// The per-site half of the catalogue: `buildEditorConfig({ blocks: [
// ...SHARED_BLOCKS, ...SITE_BLOCKS ] })`. Everything here is Tailwind-styled,
// which is exactly why it lives in the app rather than in @elkdonis/blocks —
// a utility-classed block in the shared package renders unstyled in any app
// that has not pointed Tailwind at the library's source.
//
// Sources, and what each one cost:
//
// A trap that applies to ALL of them: this site skips Tailwind's preflight, so
// the browser's own defaults survive. Harvested markup is written assuming
// preflight has zeroed them, so a copied section will quietly inherit
// `blockquote { margin: 1em 40px }`, list bullets, default heading sizes and
// fieldset borders. Neutralise them per element (`m-0`, `list-none`) as you go.
//
//   banner          HyperUI (MIT)          markup only, VERBATIM classes
//   feature-grid    HyperUI (MIT)          markup only, VERBATIM classes
//   invitation      HyperUI (MIT)          markup only
//   press-quotes    HyperUI (MIT)          markup only
//   opening         Preline (MIT + Fair Use — ATTRIBUTION REQUIRED, /credits)
//   career-timeline daisyUI (MIT)          a dependency + a theme mapping
// ============================================================================

import type { Block } from "@elkdonis/blocks";
import { invitation } from "./invitation";
import { pressQuotes } from "./press-quotes";
import { opening } from "./opening";
import { careerTimeline } from "./career-timeline";
import { banner } from "./banner";
import { featureGrid } from "./feature-grid";

export { invitation, pressQuotes, opening, careerTimeline, banner, featureGrid };

export const SITE_BLOCKS = [
  banner,
  opening,
  featureGrid,
  pressQuotes,
  careerTimeline,
  invitation,
] as unknown as Block<never>[];
