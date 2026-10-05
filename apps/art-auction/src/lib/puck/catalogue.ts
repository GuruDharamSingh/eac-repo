import { SHARED_BLOCKS, type Block } from "@elkdonis/blocks";
import { AU_BLOCKS, HARVEST_BLOCKS } from "@/blocks";

/**
 * The blocks this site's pages offer: its own, the harvested sections, then a
 * curated part of the shared set. Not all of SHARED_BLOCKS: several draw a
 * person's store or a profile and need a host that supplies that person, and
 * `feature-card` binds to records through a resolver this site does not have.
 */
const SHARED_IDS = new Set([
  "hero-banner",
  "section-banner",
  "section-heading",
  "split-row",
  "grid",
  "flow-column",
  "card-grid",
  "divider",
  "prose",
  "figure",
  "text-image",
  "quote",
  "faq",
  "video",
  "entry-list",
  "picture-wall",
  "link-button",
]);

export const CATALOGUE: Block<never>[] = [
  ...AU_BLOCKS,
  ...HARVEST_BLOCKS,
  ...SHARED_BLOCKS.filter((b) => SHARED_IDS.has(b.def.id)),
];
