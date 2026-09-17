// ============================================================================
// What may name a page.
//
// Its own module because a ROUTE needs this before it has any reason to touch
// the database — a malformed slug is a 404, not a query — and because the
// store imports @elkdonis/db, which must never be reachable from the client
// entry point. One rule, two callers, no db in the way.
// ============================================================================

/** Slugs are used in a URL and in a storage key, so keep them boring. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,48}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/**
 * A page's PATH — one or more slug segments, as a real URL has.
 *
 * `isValidSlug` governs a single segment. A site built entirely in the editor
 * needs nesting too: `about`, but also `about/press` and `work/2024`. Each
 * segment is checked by the same rule, so nothing new is allowed into a
 * storage key or a URL; what is new is only that there may be several.
 *
 * Depth is capped at three. Not a technical limit — a limit on how lost
 * someone can get building their own site, and on how long a stored key can
 * grow from user input.
 */
export const MAX_PATH_DEPTH = 3;

export function isValidPagePath(path: string): boolean {
  const segments = path.split("/");
  if (segments.length === 0 || segments.length > MAX_PATH_DEPTH) return false;
  return segments.every((segment) => isValidSlug(segment));
}
