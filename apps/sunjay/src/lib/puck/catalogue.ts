import { SHARED_BLOCKS, type Block } from "@elkdonis/blocks";
import { SITE_BLOCKS } from "@/blocks";

/**
 * The blocks this site offers: the site's own, then a curated part of the
 * shared set.
 *
 * Not all of SHARED_BLOCKS. Several of those draw a person's store or a
 * profile's galleries and need a host that supplies that person (ArtDirect,
 * IFAC, the market); here they would render empty. `contact-form` posts to
 * `/api/contact`, which this site does not have (its form is `/api/inquiry`).
 * `feature-card` binds to records through a host resolver this site lacks.
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
  "thread-feed",
]);

export const CATALOGUE: Block<never>[] = [
  ...SITE_BLOCKS,
  ...SHARED_BLOCKS.filter((b) => SHARED_IDS.has(b.def.id)),
];
