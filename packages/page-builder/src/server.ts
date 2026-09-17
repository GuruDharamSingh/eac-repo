// ============================================================================
// The page store — the half that talks to Postgres.
//
// A separate entry point so that importing the editor, the fields or the
// config never drags @elkdonis/db into a client bundle. Same split, and the
// same reason, as @elkdonis/blocks and its /server entry.
// ============================================================================

export { loadPage, savePage, listPages, isValidSlug } from "./store";
export { isValidPagePath, MAX_PATH_DEPTH } from "./slug";
export type { PuckPage } from "./store";
