// ============================================================================
// @elkdonis/blocks/record — the parts of a "smart" record block (one record,
// placed anywhere, adapting to where it sits and how wide it is), extracted
// from katie-the-potter's ktp-piece (2026-11-06).
//
//   import { placementRules, layoutChoice, effectiveLayout, layoutProp, editingOf, describeLayout,
//            RecordFrame, RecordEmpty, stripResolvedKeys, defineLooks } from "@elkdonis/blocks/record";
//   // once, at the app ROOT (so Puck's iframe mirrors it), like blocks.css:
//   @import "@elkdonis/blocks/record.css" layer(components);
//
// Pure and client-safe: no Next, no database. The app keeps its own block
// ids, props, parts, breakpoints and looks; this supplies the rules and the
// two wrappers. Guide: docs/reference/record-blocks.md.
// ============================================================================

export {
  BASE_RULES,
  placementRules,
  layoutChoice,
  effectiveLayout,
  describeLayout,
  layoutProp,
  editingOf,
  type RecordLayout,
  type RecordLayoutChoice,
  type RecordWhere,
  type PlacementLike,
  type PlacementRuleSets,
  type ResolvedPlacement,
  type PuckEditing,
} from "./placement";
export { RecordFrame, RecordEmpty, type RecordFrameProps } from "./frame";
export { stripResolvedKeys } from "./resolved";
export { defineLooks, type LookOption } from "./looks";
