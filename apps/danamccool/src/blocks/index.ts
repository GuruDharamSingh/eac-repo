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
//
// And hers alone — plain CSS in site.css (`dm-*`), drawn from her old site:
//
//   dm-star-diamond  the star-chart front door with the white diamond
//   dm-image-set     a titled set of thumbnails, full size on click (no JS)
//   dm-plate         one centred picture with its words, catalogue-style
//   dm-artwork-wall  her artworks: a collection, or hand-picked pieces
//   dm-circle-text   a picture beside words, circle-cropped (her Manifestos)
//   dm-writing-shelf her blog's latest pieces (data-driven)
//   dm-gallery-grid  a gallery as IFAC shows an artist: square tiles, hover
//                    titles, slideshow; drag/resize in place when signed in
//
// HOW A BLOCK HERE IS BUILT — so every one can be edited in Puck by someone
// who is not a developer, and none of them needs a developer to add content:
//
//   1. Manual first. Every value a visitor sees is a field: text, a picture
//      from the media picker, a select. A block with nothing bound and
//      nothing fetched must still be completely fillable by hand.
//   2. Bindings are optional, and a typed value always wins. A block that
//      shows a RECORD (an artwork) has an `artwork` field declared with
//      `binds: "artwork"` (see artworkProp in ./artwork-data). Puck shows it
//      as a picker; binding fills whatever was left blank. Only the id is
//      stored, and the record is read at render, so selling or retitling a
//      piece updates every page. Resolvers: lib/puck/config.*.ts.
//   3. Lists offer both ways: fill themselves from data (a collection), OR
//      hand-picked rows, each row bound and individually overridable.
//   4. Sale state is never typed into a page. It comes from the record:
//      for sale → price + enquire link; sold → "Sold"; portfolio (not for
//      sale, set at /manage/artworks) → picture only. A page may still ask
//      for "picture only" on a piece that is for sale; it can never make an
//      unlisted piece look buyable.
//   5. Sizes are sliders (number props with min/max); layout choices are
//      selects; anything that repeats is `rows` with a `summary`, so the
//      editor's list reads "Portrait of a Friend", not "Item #3".
// ============================================================================

import type { Block } from "@elkdonis/blocks";
import { invitation } from "./invitation";
import { pressQuotes } from "./press-quotes";
import { opening } from "./opening";
import { careerTimeline } from "./career-timeline";
import { banner } from "./banner";
import { featureGrid } from "./feature-grid";
import { starDiamond } from "./star-diamond";
import { imageSet } from "./image-set";
import { plate } from "./plate";
import { artworkWall } from "./artwork-wall";
import { circleText } from "./circle-text";
import { writingShelf } from "./writing-shelf";
import { galleryGrid } from "./gallery-grid";

export { invitation, pressQuotes, opening, careerTimeline, banner, featureGrid };
export { starDiamond, imageSet, plate, artworkWall, circleText, writingShelf, galleryGrid };

export const SITE_BLOCKS = [
  starDiamond,
  plate,
  circleText,
  imageSet,
  artworkWall,
  writingShelf,
  galleryGrid,
  banner,
  opening,
  featureGrid,
  pressQuotes,
  careerTimeline,
  invitation,
] as unknown as Block<never>[];
