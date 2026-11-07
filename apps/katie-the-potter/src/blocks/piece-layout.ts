// ============================================================================
// How a smart piece (ktp-piece) decides its layout when it is set to "auto":
// this site's parents added to the shared rules in @elkdonis/blocks/record
// (guide: docs/reference/record-blocks.md).
//
//   PROXIMITY  the resolver maps `metadata.placement` with layoutFromPlacement:
//                in ktp-quick-landing                    -> feature (this site's; no shared block has a feature slot)
//                in split-row / flow-column              -> compact
//                in ktp-piece-row / grid / card-grid     -> card
//                on the page itself                      -> card at the page measure
//   WIDTH      container queries on the frame (piece-block.css) refine it.
//
// To add a parent (say a new two-column block), add its id to the right set.
// ============================================================================

import { placementRules } from "@elkdonis/blocks/record";

export type { PlacementLike, RecordLayout as PieceLayout, RecordWhere as PieceWhere } from "@elkdonis/blocks/record";

export const layoutFromPlacement = placementRules({
  feature: ["ktp-quick-landing"],
  card: ["ktp-piece-row"],
  rowLabel: "in a row of pieces",
});
