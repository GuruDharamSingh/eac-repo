// ============================================================================
// Card LOOKS: the client directions from the design canvas (2026-11-06) as
// presets any card can wear. Pure data (the plumbing is defineLooks from
// @elkdonis/blocks/record): the blocks, the site style schema and the client
// config all read it.
//
//   house      the shop as designed (cream, terracotta)
//   ember      wood-fired: arched kiln-mouth picture, kiln glow, embers,
//              a gloss sweep on hover
//   glaze-lab  made to order: a banding wheel under the piece, the piece's own
//              pictures as glaze swatches that pour over the picture
//   profile    a hang tag: the piece drawn as a line section, the finished
//              piece wiping in on hover, the record's own dimensions
//
// Where a card gets its look (nearest wins, all in CSS, so it is live in the
// editor and the popup alike; see looks.css):
//   1. the card's own block (the Piece's `look`, or the grid's for its cards)
//   2. the Row of pieces it sits in (`look` on ktp-piece-row)
//   3. the site default (Site style, Shop, Card look: `--ktp-look`), written
//      as `data-site-look` on <body> and on the editor canvas
// "" means "as around it". Never rename a value: they are stored in pages.
// ============================================================================

import { defineLooks } from "@elkdonis/blocks/record";

export const { LOOKS, lookOf, lookProp, SITE_LOOK_VAR } = defineLooks(
  [
    { value: "house", label: "House (cream and terracotta)" },
    { value: "ember", label: "Ember (wood-fired, kiln glow)" },
    { value: "glaze-lab", label: "Glaze Lab (swatches, made to order)" },
    { value: "profile", label: "Profile (hang tag, section drawing)" },
  ],
  // SITE_LOOK_VAR: the Site style variable that holds the shop-wide default.
  { siteVar: "--ktp-look", inheritLabel: "As around it (row, then the site)" },
);

export type Look = (typeof LOOKS)[number]["value"];
