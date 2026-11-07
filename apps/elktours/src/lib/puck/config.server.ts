import type { Block } from "@elkdonis/blocks";
import { BOX_BLOCKS, BOX_ROOT } from "@elkdonis/direct-edit/puck/blocks";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder/config";
import { featuredWho } from "@/lib/featured-person";
import { cardRecord, resolveOpens } from "@/lib/opens-server";
import { PAGE_BLOCKS } from "./catalogue";

/**
 * The catalogue a published page draws with (the landing page and pages from /manage/builder, 2026-11-06): the box
 * blocks and the page blocks. Featured person's `who` is read here on every request from the stored reference;
 * `morph` draws a block's look on its page. Server only: it reaches the database.
 */
const resolvers: BlockResolvers = {
  "featured-person": async (props) => ({ who: await featuredWho(props.person), opened: await resolveOpens(props.opens) }),
  // Opens (2026-11-06): where a Button or Card goes, read per request; a Card is also filled from a tour or experience.
  "link-button": async (props) => ({ opened: await resolveOpens(props.opens) }),
  "feature-card": async (props) => ({ bound: await cardRecord(props.record), opened: await resolveOpens(props.opens) }),
};

export const serverPuckConfig = buildPuckConfig({
  blocks: [...(BOX_BLOCKS as unknown as Block<never>[]), ...PAGE_BLOCKS],
  root: BOX_ROOT,
  resolvers,
  morph: MorphMark,
});
