// @elkdonis/content/server: the server side of the content library.
//
// 2026-11-12: `listContent` (pass 2's list loader) and the access helpers.
// `loadContentDetail` is not built; until then Channel fills the passport
// client-side from the Piece it already loads
// (apps/arts-collective/src/lib/channel/content-detail.ts).
//
// Server code only: it imports the database client.

export type { ContentDetailModel, ContentListItem, ContentRef, ContentStore, ContentType } from "../model";
export { listContent } from "./list";
export type { ContentListQuery, ContentListResult } from "./list";
export { mayManageOrg, PERSONAL_ORG, resolveRights, threadReadSql } from "./access";
export type { ContentRights, ContentViewer } from "./access";
