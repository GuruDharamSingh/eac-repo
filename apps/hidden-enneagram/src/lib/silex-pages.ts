/**
 * The Silex pages published in Nextcloud (besides index, which `/` no longer
 * draws). `[page]` still serves them unless a studio page is published at the
 * same address; the studio index marks such a page "replaces the Silex page".
 */
export const SILEX_PAGES: ReadonlySet<string> = new Set([
  "introduction",
  "centers",
  "contact",
  "type-1",
  "type-2",
  "type-3",
  "type-4",
  "type-5",
  "type-6",
  "type-7",
  "type-8",
  "type-9",
]);
