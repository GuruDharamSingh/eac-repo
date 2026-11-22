// ============================================================================
// @elkdonis/house-editor: the house editor (2026-11-20). Client side: React,
// page-builder and Puck (peer dependencies); the rest of direct-edit stays
// plain DOM and imports none of this. page-builder never imports direct-edit.
//
//   HouseEditor        the canvas on one stored page (an app binds it in ~30 lines)
//   HouseWholePage     Puck's editor on the whole page with the same plugin set
//   openHouseLanding   a code-drawn page opened as a tree, same guard
//   createSavePageAction  the page-save action, once (an app's "use server" file calls it)
//
// A "use server" file imports "@elkdonis/house-editor/server" instead: no React, no Puck.
// ============================================================================

export { HouseEditor, type HouseEditorProps } from "./HouseEditor";
export { HouseWholePage, type HouseWholePageProps } from "./HouseWholePage";
export { openHouse } from "./open";
export type { HouseOptions, HouseConfig, HouseLoaded, HouseFlags, HouseRoutes, HousePages } from "./open";
export { openHouseLanding, type HouseLandingOptions } from "./landing";
export { createSavePageAction, holdVersion, STALE_CANVAS_MESSAGE } from "./save";
export type { HouseSave, HouseSaveResult, SavePageActionOptions } from "./save";
export { resolvedRows, withProps } from "./walk";
export type { ResolvedRows, ResolvedKeys } from "./walk";
