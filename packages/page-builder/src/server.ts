// ============================================================================
// The page store — the half that talks to Postgres.
//
// A separate entry point so that importing the editor, the fields or the
// config never drags @elkdonis/db into a client bundle. Same split, and the
// same reason, as @elkdonis/blocks and its /server entry.
// ============================================================================

export { loadPage, loadPageWithVersion, savePage, listPages, isValidSlug } from "./store";
export {
  loadUserPage,
  loadPublishedUserPage,
  saveUserPage,
  publishUserPage,
  listUserPages,
  type UserPage,
  type UserPageStatus,
} from "./user-store";
export { isValidPagePath, MAX_PATH_DEPTH } from "./slug";
export type { PuckPage, SavePageResult } from "./store";
export { loadDraft, saveDraft, publishDraft, discardDraft, listDrafts, parseDraft } from "./drafts";
export type { PageDraft, DraftAuthor, DraftInput, DraftOptions, PublishOptions } from "./drafts";
