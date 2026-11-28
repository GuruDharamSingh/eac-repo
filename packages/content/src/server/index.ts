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

// Search core (CONTRACT.md §3, §4, §10), added 2026-11-26.
export { searchContent, resolveContentRefs } from "./search";
export { contentReadSql, isSiteKeeper, siteOrgIds } from "./access";
export type { ContentReadOptions } from "./access";
export type { ContentQuery, ContentRefResult, ContentScope, ContentSearchResult, ContentSort, ContentSale, ContentSaleState } from "../search-types";
// Directory identities (v1.3, CONTRACT §15), added 2026-11-26.
export type { ContentListingKind, ContentPerson } from "../model";
export type { ContentFacetCount } from "../search-types";

// Search suggestions (people, orgs, pieces), added 2026-11-26.
export { suggestContent } from "./suggest";
export type { ContentSuggestions, SuggestOrg, SuggestPerson, SuggestPiece } from "./suggest";

// Content-library checkout (v1.4, CONTRACT §17), added 2026-11-27: a host mounts contentRoutes(host, { payments, limiter }).
export { redisRateLimiter } from "./checkout";
export type { ContentPayments, RateLimiter } from "./checkout";

// What commerce will charge for a thread (lane P, 2026-11-27): pages call this so the price shown is the price charged.
export { threadChargeFor, chargeOfThreadRow } from "./offers";
export type { ThreadCharge } from "./offers";
