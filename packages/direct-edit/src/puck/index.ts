// @elkdonis/direct-edit/puck: the box tree on Puck's data (2026-11-02). Client only;
// the blocks alone, for a server config, are at @elkdonis/direct-edit/puck/blocks.
export { BOX_BLOCKS, BOX_ROOT, BOX_NAMES, WORD_NAMES } from "./blocks";
export { TreeCanvas, type TreeConfig } from "./TreeCanvas";
export { mountTreePage, type TreePageOptions } from "./mount";
export { openPageAsTree, openVisitorPage, type OpenPageOptions, type VisitorPageOptions } from "./open-page";
export { adoptChildren, adoptElement, type AdoptOptions } from "../canvas/adopt";
// The part panel inside Puck's own editor (2026-11-06): passed to page-builder's partsPlugin as `panel`.
export { mountLookPanel, type LookPanelContext } from "./look-panel";
// The block popup opened from Puck Studio (2026-11-06): passed to page-builder's partsPlugin as `popup`.
export { openStudioPopup, type StudioPopupContext, type StudioPopupHost } from "./studio-popup";
// "From what?" for props that hold a reference to a record (2026-11-06): passed to mountTreePage / openPageAsTree as `records`.
export { mountRecordChooser, type RecordSources, type RecordChoice, type RecordSourceItem } from "../canvas/records";
