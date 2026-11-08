// ============================================================================
// This site's own blocks, registered in BOTH lib/puck/config.server.ts and
// lib/puck/config.client.ts (a block missing from the server config renders
// nothing on the published page). Block ids, prop names and part names are
// stored in page JSON: never rename one.
//
//   he-hero        Opening: title with a lit phrase, lede, links, the figure as ornament
//   he-passage     Passage: a section of writing, optional chapter links beside it
//   he-enneagram   The Figure: Ario's instrument, reader by placement (smart block), sound
//   he-reading     A reading: the figure stepped through for one person (page goes noindex)
//   he-music-web   Web of music: the twelve notes beside the nine, ring or Tonnetz
//   he-course      Course card: the Sophia course, read from the published version
//   Round 3 (2026-11-07, the quiet redesign):
//   he-welcome     Welcome band: a greeting and a rule beside a letter (art-auction's .hw)
//   he-orb         Glow (orb): the white-core glow between bands
//   he-works       Work impressions: pictures, recordings, video; a quiet line until there are any
//   he-shelf       Cards from the site: the services, or a feed's posts (smart)
//   he-type        A type's chapter: #type-N, opens in place or as a Surface popup
//   he-contact     Contact form (/api/org/<org>/contact)
//   he-forum       The forum's newest topics (smart)
//   he-person      A person: portrait, role, statement or bio (smart)
//   he-service     A service with Book and pay, straight to Stripe (smart; the /services/<slug> template)
//   Round 6 (2026-11-08, Puck-first):
//   he-post        The post in the address: title, date, author, cover, text (smart; the /<feed>/<slug> template)
//                  (he-person's "page" shape is the /about/<slug> template)
//
// Styles: components/aeon/aeon.css + sound.css, components/reading/reading.css,
// components/music/music.css, imported at the ROOT (app/globals.css) so Puck's
// canvas iframe mirrors them.
// ============================================================================

import type { Block } from "@elkdonis/blocks";
import { heHero } from "./hero";
import { hePassage } from "./passage";
import { heEnneagram } from "./enneagram-block";
import { heReading } from "./reading-block";
import { heMusicWeb } from "./music-web-block";
import { heCourse } from "./course-card";
import { heWelcome, heOrb, heWorks } from "./house";
import { heShelf } from "./shelf";
import { heType } from "./type-chapter";
import { heContact, heForum, hePerson } from "./records";
import { heService } from "./service";
import { hePost } from "./post";

export { heHero, hePassage, heEnneagram, heReading, heMusicWeb, heCourse, heWelcome, heOrb, heWorks, heShelf, heType, heContact, heForum, hePerson, heService, hePost };

export const SITE_BLOCKS = [
  heWelcome, heHero, hePassage, heEnneagram, heType, heShelf, heService, hePost, heWorks, hePerson, heContact, heForum, heOrb, heReading, heMusicWeb, heCourse,
] as unknown as Block<never>[];
