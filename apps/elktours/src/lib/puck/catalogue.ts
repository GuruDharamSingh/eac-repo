import { SHARED_BLOCKS, featuredPerson, type Block } from "@elkdonis/blocks";
import { MOBILE_BLOCK_LIST } from "@/blocks/mobile";
import { heroCityTitle } from "@/components/landing/hero-city-block";
import { tourCards } from "@/components/landing/tour-cards-block";
import { TEMPLATE_BLOCK_LIST } from "@/blocks/template";

/**
 * The blocks this site's pages offer (2026-11-06): a curated part of the shared set, and Featured person. One list
 * for the landing editor, new pages and Puck Studio, so a block placed in one draws in the others.
 *
 * Not all of SHARED_BLOCKS: the profile, gallery and store blocks need a host that supplies a person (ArtDirect,
 * the market); `contact-form` posts to `/api/contact`, which this site does not have (its form is /api/inquiry);
 * `feature-card` binds through a resolver this site lacks; `thread-feed` lists upcoming events, which this site
 * does not publish. No database imports here: the client configs read this file.
 */
const SHARED_IDS = new Set([
  "split-row",
  "grid",
  "flow-column",
  "card-grid",
  "divider",
  "section-heading",
  "prose",
  "figure",
  "text-image",
  "quote",
  "faq",
  "video",
  "entry-list",
  "picture-wall",
  "link-button",
  "feature-card",
]);

export const PAGE_BLOCKS: Block<never>[] = [
  ...SHARED_BLOCKS.filter((b) => SHARED_IDS.has(b.def.id)),
  featuredPerson as unknown as Block<never>,
  // The desktop landing's heading with its city chooser (2026-11-21): a block, so its words have settings.
  heroCityTitle as unknown as Block<never>,
  // The desktop landing's tour list (2026-11-21), with settings for which tours, how many and in what order.
  tourCards as unknown as Block<never>,
  // Booking options and Map and locations (TEMPLATE lane, 2026-11-21): draw the record in the address.
  ...TEMPLATE_BLOCK_LIST,
];

/**
 * The blocks a phone document (m-*) offers (G2, 2026-11-15): the mobile blocks, and the generic text and
 * layout ones from the shared set. Only the m-* editors and draws use this list; PAGE_BLOCKS is unchanged.
 */
const MOBILE_GENERIC_IDS = new Set(["section-heading", "prose", "divider", "figure"]);
export const MOBILE_BLOCKS: Block<never>[] = [
  ...MOBILE_BLOCK_LIST,
  ...TEMPLATE_BLOCK_LIST,
  ...SHARED_BLOCKS.filter((b) => MOBILE_GENERIC_IDS.has(b.def.id)),
];
