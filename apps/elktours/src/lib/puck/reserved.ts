import { LANDING_SLUG } from "./landing";

// ============================================================================
// Top-level paths a page may not take (2026-11-06). A page at `/<slug>` is
// served by the `/[feed]` route once no section answers to that name, and a
// static route wins over `/[feed]`, so a page saved at one of these would be
// stored and never shown. Refused at save time instead.
// ============================================================================

/** Documents that are layouts for generated pages, edited in their own studios, never served at /<slug>. */
export const TEMPLATE_SLUGS: ReadonlySet<string> = new Set(["tour-detail", "experience-detail", LANDING_SLUG]);

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...TEMPLATE_SLUGS,
  "about", "account", "api", "bookings", "center", "experiences", "forum", "hub", "journal",
  "login", "manage", "places", "services", "studio", "tours", "home", "_next",
]);
