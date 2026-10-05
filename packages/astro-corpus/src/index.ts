/**
 * @elkdonis/astro-corpus — client-safe part: the factor registry and the
 * text tagger. Database access is in `./server`.
 *
 * Design and phases: docs/open/ASTRO_STUDIO_BRIEF_2026-09-26.md.
 */

export * from "./factors";
export * from "./tagger";
export * from "./questions";
export { groupKey, matchGroup, similarGroups } from "./vocab-rules";
export { citeText, termPagesText, FOUNDATION_MODES, FOUNDATION_ROLES } from "./foundations-rules";
export { READING_GROUPS, readingGroup, readingLabel } from "./library-rules";
export { deriveCompounds } from "./compounds";
