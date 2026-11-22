import { templateServerResolvers } from "@/blocks/template/resolvers";
import type { Block } from "@elkdonis/blocks";
import { BOX_BLOCKS, BOX_ROOT } from "@elkdonis/direct-edit/puck/blocks";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder/config";
import { recordMarks } from "@elkdonis/house-editor/fields/marks";
import { featuredWho } from "@/lib/featured-person";
import { cardRecord, resolveOpens } from "@/lib/opens-server";
import { PAGE_BLOCKS } from "./catalogue";
import { tourCardsFor } from "./mobile-pick";

/**
 * The catalogue a published page draws with (the landing page and pages from /manage/builder, 2026-11-06): the box
 * blocks and the page blocks. Featured person's `who` is read here on every request from the stored reference;
 * `morph` draws a block's look on its page. Server only: it reaches the database.
 */
const resolvers: BlockResolvers = {
  ...templateServerResolvers,
  "featured-person": async (props) => ({ who: await featuredWho(props.person), opened: await resolveOpens(props.opens) }),
  // Opens (2026-11-06): where a Button or Card goes, read per request; a Card is also filled from a tour or experience.
  "link-button": async (props) => ({ opened: await resolveOpens(props.opens) }),
  // The landing's tour list (2026-11-21): which tours, how many, in what order, read per request.
  "tour-cards": async (props) => ({ cards: await tourCardsFor(props) }),
  "feature-card": async (props) => ({ bound: await cardRecord(props.record), opened: await resolveOpens(props.opens) }),
};

/** Every block a page of this site may hold: the canvas's boxes, then the page blocks. */
export const serverBlocks = [...(BOX_BLOCKS as unknown as Block<never>[]), ...PAGE_BLOCKS];

const serverOptions = { blocks: serverBlocks, root: BOX_ROOT, resolvers, morph: MorphMark };

export const serverPuckConfig = buildPuckConfig(serverOptions);

/**
 * The same page drawn for someone who may edit it (live editor, 2026-11-20): an inert marker before each block, so the
 * Fields lens can offer a block's own words for typing on the page, and, where a card shows a tour's or experience's title
 * because its own was left empty, that title (read only: no catalogue entry renames one). Never used for a visitor: their
 * markup is `serverPuckConfig`'s, unchanged.
 */
export const markedPuckConfig = buildPuckConfig({
  ...serverOptions,
  marks: {
    from: recordMarks({
      // feature-card.tsx: "typed first; the record fills only what was left blank". `record` is `thread:<id>`, `bound` what cardRecord read.
      "feature-card": { ref: "record", kinds: ["thread"], resolved: "bound", fills: { title: "title", body: "excerpt", meta: "meta" } },
    }),
  },
});
