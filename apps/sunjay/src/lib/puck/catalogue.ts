import { SHARED_BLOCKS, featuredPerson, type Block } from "@elkdonis/blocks";
import { SITE_BLOCKS } from "@/blocks";

/**
 * The blocks this site offers: the site's own, then a curated part of the
 * shared set.
 *
 * Not all of SHARED_BLOCKS. Several of those draw a person's store or a
 * profile's galleries and need a host that supplies that person (ArtDirect,
 * IFAC, the market); here they would render empty. `contact-form` posts to
 * `/api/contact`, which this site does not have (its form is `/api/inquiry`).
 * `feature-card` is filled from a gathering, series or piece through this site's resolver (2026-11-07,
 * lib/opens-server.ts), and Featured person comes with it.
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
  "feature-card",
  // Layout blocks added 2026-11-07.
  "sticky-split",
  "tab-set",
  "accordion-set",
]);

export const CATALOGUE: Block<never>[] = [
  ...SITE_BLOCKS,
  ...SHARED_BLOCKS.filter((b) => SHARED_IDS.has(b.def.id)),
  featuredPerson as unknown as Block<never>,
];
