import type { HubCard } from "./types";

// ============================================================================
// The tile catalogue.
//
// One definition of each tile's words, glyph and target — but availability is
// a HOST fact, not a shared constant, so it is passed in. This matters: the
// two template apps mark files, questionnaires and help "unavailable" while
// IFAC has them built for real. A shared array with availability baked in
// would have told IFAC's members their working features don't exist.
//
// The live tiles are not here — they are built from data in each host's hub
// page, because their face draws real content rather than a description:
// calendar, standing meeting, pipeline, chat, forum, and now gallery, compose,
// profile, documents and ideas as well. What is left in this catalogue is the
// tiles that genuinely are a word and a door.
// ============================================================================

export interface HubCapabilities {
  /** A browsable file tree. */
  files?: boolean;
  /** Questionnaires and group research. */
  questionnaires?: boolean;
  /** A help/notes panel. */
  help?: boolean;
  /** Where "Manage site" goes. Omit to drop the tile entirely. */
  manageHref?: string | null;
}

/**
 * The catalogue for one host. Tiles whose capability is false are KEPT but
 * marked unavailable; tiles whose href is omitted are dropped, because a
 * "Manage site" tile with nowhere to go is worse than no tile.
 */
export function hubCards(caps: HubCapabilities = {}): HubCard[] {
  const cards: HubCard[] = [];

  cards.push({
    id: "files",
    title: "Files",
    blurb: "Browse the group's storage.",
    kind: "neutral",
    glyph: "▥",
    available: Boolean(caps.files),
  });

  if (caps.manageHref) {
    cards.push({
      id: "manage_site",
      title: "Manage site",
      blurb: "Pages, people and roles.",
      kind: "neutral",
      glyph: "⚙",
      href: caps.manageHref,
      available: true,
      adminOnly: true,
    });
  }

  cards.push(
    {
      id: "questionnaires",
      title: "Questionnaires & group research",
      blurb: "Ask the membership something, and read the results.",
      kind: "questionnaire",
      available: Boolean(caps.questionnaires),
      wide: true,
    },
    {
      id: "help",
      title: "Help & notes from the developer",
      blurb: "How things work, and how to tell us they don't.",
      kind: "neutral",
      glyph: "?",
      available: Boolean(caps.help),
      wide: true,
    }
  );

  return cards;
}
