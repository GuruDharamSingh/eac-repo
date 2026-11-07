// ============================================================================
// This site's own blocks, registered in BOTH lib/puck/config.server.ts and
// lib/puck/config.client.ts (a block missing from the server config renders
// nothing on the published page). Block ids, prop names and part names are
// stored in page JSON: never rename one.
//
//   he-hero        Opening: title with a lit phrase, lede, links, the figure as ornament
//   he-passage     Passage: a section of writing, optional chapter links beside it
//   he-enneagram   The Figure: Ario's instrument, reader by placement (smart block)
//   he-course      Course card: the Sophia course, read from the published version
//
// Styles: blocks/he-blocks.css + components/aeon/aeon.css, imported at the
// ROOT (app/globals.css) so Puck's canvas iframe mirrors them.
// ============================================================================

import type { Block } from "@elkdonis/blocks";
import { heHero } from "./hero";
import { hePassage } from "./passage";
import { heEnneagram } from "./enneagram-block";
import { heCourse } from "./course-card";

export { heHero, hePassage, heEnneagram, heCourse };

export const SITE_BLOCKS = [heHero, hePassage, heEnneagram, heCourse] as unknown as Block<never>[];
