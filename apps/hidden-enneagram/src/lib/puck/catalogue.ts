import { SHARED_BLOCKS, type Block } from "@elkdonis/blocks";
import { SITE_BLOCKS } from "@/blocks";

/**
 * The blocks this site offers: its own four first, then a curated part of the
 * shared set (katie's list, plus the three layout blocks). Not all of
 * SHARED_BLOCKS: several draw a person's store or profile and need a host that
 * supplies that person; `contact-form` posts to a route this site does not
 * have; `feature-card` binds to records through a resolver this site lacks.
 *
 * card-grid is left out (2026-11-07): the shared set labels it "Grid" like
 * `grid`, so the list showed two "Grid"s; `grid` (rows and columns, or
 * automatic columns) covers it. No stored page of this site used card-grid.
 *
 * Import-free beyond the catalogues, so the client config can read it without
 * pulling the database in.
 */
const SHARED_IDS = new Set([
  "split-row",
  "grid",
  "flow-column",
  "sticky-split",
  "tab-set",
  "accordion-set",
  "divider",
  "section-heading",
  "section-banner",
  "hero-banner",
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

export const CATALOGUE: Block<never>[] = [...SITE_BLOCKS, ...SHARED_BLOCKS.filter((b) => SHARED_IDS.has(b.def.id))];
