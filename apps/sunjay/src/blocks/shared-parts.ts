import type { BlockDef } from "@elkdonis/blocks";

// ============================================================================
// Parts of the faces the catalogue's blocks and the home page's live pieces both draw. Data only: the home page
// must not import data-blocks, which would add every catalogue component to each visitor's scripts.
// Selectors over today's markup: a data-part attribute would change what every visitor is sent.
// ============================================================================

type Parts = NonNullable<BlockDef["parts"]>;

export const STANDING_PARTS: Parts = {
  root: { label: "Next gathering", sel: '> div' },
  card: { label: "Card", sel: 'article.eac-face' },
  glyph: { label: "Mark", sel: '.eac-face-glyph' },
  picture: { label: "Picture", sel: '.eac-preview-cover' },
  when: { label: "When", sel: '.eac-preview-line' },
  coming: { label: "Who is coming", sel: '.eac-preview-cue' },
  kicker: { label: "Small label", sel: '.eac-face-kicker' },
  title: { label: "Title", sel: '.eac-face-title' },
  blurb: { label: "Summary", sel: '.eac-face-blurb' },
};

export const FORUM_PARTS: Parts = {
  root: { label: "Forum", sel: '> div' },
  heading: { label: "Heading", sel: 'h2', prop: "heading" },
  card: { label: "Card", sel: 'article.eac-face' },
  feeds: { label: "Sections", sel: '.eac-forum-face-feed' },
  rows: { label: "Topics", sel: '.eac-forum-mini' },
  row: { label: "Topic", sel: '.eac-forum-mini-row' },
  rowTitle: { label: "Topic title", sel: '.eac-forum-mini-title' },
  rowWhen: { label: "Topic age", sel: '.eac-forum-mini-when' },
  title: { label: "Title", sel: '.eac-face-title' },
  blurb: { label: "Summary", sel: '.eac-face-blurb' },
};

/**
 * Which gathering "Next gathering" shows (2026-11-14): pt-standing and the home page's home-standing. Chosen with
 * "From what?" (`binds: "gathering"`, components/landing/person-records.ts). Values: lib/puck/data-standing.ts
 * `whichOf` — "standing" (also missing: every block stored before this), "next", "thread:<id>".
 */
export const WHICH_GATHERING_PROP = {
  name: "which",
  kind: "string",
  binds: "gathering",
  label: "Which gathering",
  description: "The standing meeting (as before), the next upcoming gathering, or one particular gathering. Every choice follows the calendar.",
  default: "standing",
} as const;
