// ============================================================================
// Names a designed page may not take, and the template documents.
//
// A page at `/<slug>` is served by `app/[slug]/page.tsx` once no real route
// answers; a static route always wins, so a page saved under one of these names
// would be stored and never shown. Refused at save time instead.
//
// TEMPLATE_SLUGS are documents that draw generated pages (`article-detail`
// draws /read/<slug>). Editable at /edit/<slug>, never served at /<slug>.
// ============================================================================

export const TEMPLATE_SLUGS: ReadonlySet<string> = new Set(["article-detail"]);

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...TEMPLATE_SLUGS,
  "about",
  "account",
  "admin",
  "api",
  "artists",
  "artworks",
  "cart",
  "checkout",
  "edit",
  "gallery",
  "home",
  "login",
  "lots",
  "messages",
  "orders",
  "panel",
  "read",
  "studio",
  "_next",
]);
