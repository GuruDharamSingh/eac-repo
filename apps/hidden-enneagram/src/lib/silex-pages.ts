/**
 * The Silex pages published in Nextcloud that `[page]` still serves.
 *
 * Round 3 (2026-11-07): /introduction, /centers, /contact and /type-1 … /type-9
 * left this list. Their words were folded into /enneagram (lib/exposition.ts)
 * and the landing's contact form, and the addresses redirect (next.config.ts).
 * None is left; the set stays so a page added in Silex can be listed again.
 */
export const SILEX_PAGES: ReadonlySet<string> = new Set<string>([]);
