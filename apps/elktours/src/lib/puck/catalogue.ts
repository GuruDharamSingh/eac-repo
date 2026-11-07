import { SHARED_BLOCKS, featuredPerson, type Block } from "@elkdonis/blocks";

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
];
