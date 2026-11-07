// ============================================================================
// This site's own blocks, registered in BOTH lib/puck/config.server.ts and
// lib/puck/config.client.ts (a block missing from the server config renders
// nothing on the published page). Block ids are stored in page JSON — never
// rename one.
//
//   ktp-quick-landing   the hero: picture, kicker, title, lede, a button to
//                       the grid. Tokens-styled (quick-landing.css).
//   ktp-artwork-grid    her pieces as cards, each opening a popup with the
//                       pictures, details, price and a link to buy on Collect
//                       Art. Data-driven (lib/artworks.ts) and interactive
//                       (artwork-grid.client.tsx).
//
// Every colour and size either block draws is a field or a site token; the
// generic Style layer (blkStyle) covers spacing, borders and backgrounds of
// the block as a whole, so neither declares those.
// ============================================================================

import type { Block } from "@elkdonis/blocks";
import { quickLanding } from "./quick-landing";
import { artworkGrid } from "./artwork-grid";
import { pieceBlock } from "./piece-block";
import { pieceRow } from "./piece-row";
import { pieceDetails } from "./piece-details";

export { quickLanding, artworkGrid, pieceBlock, pieceRow, pieceDetails };

//   ktp-piece           ONE piece as a smart card: layout by placement
//                       (metadata.placement) and by width (container queries)
//   ktp-piece-row       a slot of ktp-piece, arranged by hand
//   ktp-piece-details   facts, description, previous/next (the detail template)
export const SITE_BLOCKS = [quickLanding, artworkGrid, pieceBlock, pieceRow, pieceDetails] as unknown as Block<never>[];
