// ============================================================================
// @elkdonis/page-builder — the visual page editor.
//
// One adapter between @elkdonis/blocks and @puckeditor/core, plus the editor
// shell, the field controls and (behind ./server) the page store. A site that
// wants editing supplies three things and nothing else: its org id, where its
// pictures live, and a server action that may write.
//
// Client-safe: nothing reachable from this entry point imports @elkdonis/db.
// The store lives behind "@elkdonis/page-builder/server".
//
// Blocks bring their own stylesheet. Import it ONCE, in the app's ROOT layout
// rather than in a route:
//
//     import "@elkdonis/blocks/blocks.css";
//
// Puck's canvas is an iframe, and its CopyHostStyles mirrors the parent
// document's <style>/<link> tags at mount. Next scopes a route's CSS import to
// that route, so a sheet imported only by the published page is ABSENT in the
// editor — blocks then draw unstyled and Puck picks its drag axis from the
// wrong computed layout. This has already happened once.
// ============================================================================

export { buildPuckConfig, EMPTY_PAGE } from "./config";
export type { BlockResolvers, FieldRender, PuckConfigOptions } from "./config";

export { buildEditorConfig } from "./config.client";
export type { EditorConfigOptions } from "./config.client";

export { PuckEditor } from "./editor";
export type { PuckEditorProps } from "./editor";

export { ImageField } from "./fields/image-field";
export type { ImageFieldProps, MediaSources } from "./fields/image-field";
export { SizeField } from "./fields/size-field";
export type { SizeFieldProps } from "./fields/size-field";

export { CanvasDrag } from "./drag/canvas-drag";
export type { CanvasDragProps } from "./drag/canvas-drag";

export { validatePage } from "./validate";
export type { PageProblem, ValidationResult } from "./validate";

// Slug rules come from their own module, not from the store: the store imports
// @elkdonis/db, and re-exporting through it would put a database client in
// every client bundle that only wanted to check a page name.
export { isValidSlug, isValidPagePath, MAX_PATH_DEPTH } from "./slug";
