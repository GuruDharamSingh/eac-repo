// @elkdonis/content/server: the per-item loader (loadContentDetail,
// listContent, access) arrives in pass 2 of
// docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md. In pass 1 Channel fills
// the model client-side from the Piece it already loads
// (apps/arts-collective/src/lib/channel/content-detail.ts).
//
// The entry exists now so importers can point at it; it re-exports the model
// types only and carries no data access yet.

export type { ContentDetailModel, ContentRef, ContentStore, ContentType } from "../model";
