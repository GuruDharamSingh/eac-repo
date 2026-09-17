// ============================================================================
// @elkdonis/cms-ui/whiteboard — the org's shared canvas.
//
//   import { WhiteboardFace, WhiteboardSurface } from "@elkdonis/cms-ui/whiteboard";
//
// Its own subpath, not part of the `hub` barrel, because it is the only thing
// in this package that needs `@excalidraw/excalidraw` — a large dependency
// declared as an OPTIONAL peer. Importing `@elkdonis/cms-ui/hub` must not drag
// a drawing engine into an app that has no whiteboard, and keeping the entry
// separate is what guarantees that rather than relying on tree-shaking.
//
// The scene itself is `getWhiteboard`/`saveWhiteboard` in @elkdonis/services,
// which was already shared; only the component was duplicated. The host owns
// the route (and therefore the permission gate) and passes its path in.
// ============================================================================

export { WhiteboardFace } from "./WhiteboardFace";
export { WhiteboardSurface } from "./WhiteboardSurface";
