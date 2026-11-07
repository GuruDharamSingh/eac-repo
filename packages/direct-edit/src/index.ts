// @elkdonis/direct-edit: canvas-grade direct editing over block data.
// model/  schema (slots per part, freedom levels), nodes, history, css, colour
// panel/  the right-hand panel (Properties · Code · Saved)
// canvas/ overlay boxes and handles, click-deeper, inline text, drags,
//         smooth grid resize, dragging nodes between containers (pass 3)
// block/  the block document model, pure (subpath @elkdonis/direct-edit/block):
//         style vocabulary + cleaner, node tree, layout grid, data tokens
// Plan: docs/open/DIRECT_EDITING_PANEL_PLAN_2026-11-01.md

export * from "./model/schema";
export * from "./model/nodes";
export * from "./model/history";
export * from "./model/css";
export * from "./model/color";
export * from "./model/richtext";
export { Panel, type PanelContext, type PanelHandlers, type Swatch, type TextStylePreset, type LayerRow, type FontGroups, type TabId } from "./panel/panel";
export { icon, ICONS } from "./panel/icons";
export { Overlay, rectIn, type OverlayOptions } from "./canvas/overlay";
export {
  Listeners, bindCanvas, startInlineText, startGridResize, startGhostDrag, domToRich,
  type CanvasOptions, type InlineOptions, type InlineSession, type InlineState, type InlineCommand, type GridResizeOptions, type GhostDragOptions,
} from "./canvas/interact";
export { openMenu, type MenuItem, type MenuHandle } from "./canvas/menu";
export { isLayer, sectionOf, layerChain, childLayers, parentLayer, nextLayer, elementAt, layerRole, layerName, readLayers, addressOf, atAddress, selectorFor, type LayerNode } from "./canvas/layers";
export { mountClickThrough, type ClickThroughOptions, type ClickThroughHandle } from "./canvas/clickthrough";
export { mountVisualEditor, isPrivatePicture, type VisualEditorOptions, type VisualEditorHandle, type PictureChooser } from "./canvas/visual-editor";
export { mountTreeEditor, type TreeEditorOptions, type TreeEditorHandle } from "./canvas/tree-editor";
export { MiniBar, type MiniBarContext, type MiniBarHandlers, type MiniBarStyle, type Tri } from "./canvas/minibar";
export { Viewport, ZOOM_MIN, ZOOM_MAX, ZOOM_STEPS, type ViewportOptions } from "./canvas/view";
export { copyToClipboard, elementToPng } from "./canvas/export";
export { startSmoothResize, sheetGeometry, drawGridGuides, clearGridGuides, type GridGeometry, type ResizeState, type ResizeResult, type SmoothResizeOptions } from "./canvas/resize";
export { startNodeDrag, findDropSpot, type DropSpot, type DropRules, type NodeDragOptions } from "./canvas/nodedrag";
