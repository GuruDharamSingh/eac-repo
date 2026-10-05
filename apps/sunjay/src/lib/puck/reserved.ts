// ============================================================================
// Top-level paths a page may not take.
//
// A page at `/<slug>` is served by the `/[feed]` route once no feed answers to
// that name. These are the paths that already belong to the app: a static
// route wins over `/[feed]`, so a page saved at one of them would be stored
// and never shown. Refused at save time instead.
//
// `about` is reserved because `/about` is still a hand-written page.
// ============================================================================

/**
 * Documents that are templates for generated pages, not pages of their own.
 *
 * `event-detail` draws the detail page of every event that has one;
 * `journal-piece` draws every piece under /journal/<piece>. They are edited at
 * /studio/<slug> like any page, but are never served at /<slug>: the public
 * `/[feed]` fallthrough refuses them, and they cannot be chosen as a page name.
 */
export const TEMPLATE_SLUGS: ReadonlySet<string> = new Set(["event-detail", "journal-piece"]);

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...TEMPLATE_SLUGS,
  "about",
  "account",
  "api",
  "center",
  "forum",
  "hub",
  "login",
  "manage",
  "studio",
  "_next",
]);
