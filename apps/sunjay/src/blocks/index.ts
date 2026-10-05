import type { Block } from "@elkdonis/blocks";
import { band, banner, heading, link } from "./layout-blocks";
import { eventAbout, eventHeader, eventMaterials, eventRsvp, talkRoom } from "./event-blocks";
import { offeringCard } from "./offering-card";
import { booking, serviceDetail, servicesList } from "./service-blocks";
import { article, journal, seriesNav } from "./writing-blocks";
import { notice, steps } from "./small-blocks";
import { calendar, forum, gallery, member, profile, standing, threads, writing } from "./data-blocks";

// ============================================================================
// This site's own blocks: `[...SHARED_BLOCKS, ...SITE_BLOCKS]` in both
// config.client.ts and config.server.ts. A block missing from the server
// config renders nothing on the published page.
//
// A block id is stored in saved page JSON. Never rename one: `<Render>` drops
// an unknown type without a message.
//
// How the current landing page maps onto them:
//
//   banner                         pt-banner
//   next gathering                 pt-band(small) > pt-standing
//   profile | calendar             pt-band(raised) > split-row > pt-profile, pt-calendar
//   materials + from | sign up     pt-band > split-row > (pt-threads ×2), pt-member
//   about                          pt-band(raised, narrow) > pt-heading, prose, pt-link
//   forum                          pt-band > pt-forum
//   writing, gallery               pt-band > pt-writing / pt-gallery
//
// See lib/puck/home-template.ts for the document built from that table.
// ============================================================================

export const SITE_BLOCKS = [
  band,
  banner,
  heading,
  link,
  standing,
  calendar,
  profile,
  threads,
  member,
  forum,
  writing,
  gallery,
  // Event detail page
  eventHeader,
  eventAbout,
  talkRoom,
  eventRsvp,
  eventMaterials,
  offeringCard,
  // Services page
  servicesList,
  serviceDetail,
  booking,
  // Writing (Studio pieces)
  journal,
  article,
  seriesNav,
  // Small blocks used across the templates
  steps,
  notice,
] as unknown as Block<never>[];
