import { loadThreadFeed } from "@elkdonis/blocks/server";
import { SHARED_BLOCKS, type Block } from "@elkdonis/blocks";
import { BOX_BLOCKS, BOX_ROOT } from "@elkdonis/direct-edit/puck/blocks";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { siteConfig } from "@/config/site";
import { loadOfferingsData } from "@/lib/landing-offerings";
import { loadForumData } from "@/lib/landing-forum";
import { LANDING_BLOCKS } from "./landing-blocks";

// ============================================================================
// The catalogue as a PUBLISHED PAGE sees it.
//
// Same components, same fields — different resolvers. These read the database
// directly, because a server rendering its own page has no reason to make an
// HTTP request to itself. Importing this module pulls @elkdonis/db in, so it
// must never be reachable from a client component.
// ============================================================================

const serverResolvers: BlockResolvers = {
  // The landing's two live pieces as blocks (2026-11-21): read on every request, never stored.
  "offerings-band": async (props) => ({
    ...(await loadOfferingsData({
      featured: typeof props.featured === "string" ? props.featured : "",
      more: typeof props.more === "string" ? props.more : "upcoming",
      moreCount: typeof props.moreCount === "number" ? props.moreCount : 3,
    })),
  }),
  "grand-forum": async () => ({ ...(await loadForumData()), preview: false }),
  "thread-feed": async (props, metadata) => {
    const orgId = typeof metadata.orgId === "string" ? metadata.orgId : siteConfig.orgId;
    const items = await loadThreadFeed(orgId, {
      limit: typeof props.limit === "number" ? props.limit : 10,
      upcomingOnly: true,
    });
    return { items };
  },
};

/** Every block a page of this site may hold: the shared catalogue, then the canvas editor's boxes. */
export const serverBlocks = [...SHARED_BLOCKS, ...LANDING_BLOCKS, ...(BOX_BLOCKS as unknown as Block<never>[])];

// `morph` draws a block's stored look (the look panel) on the page; without it a saved look is kept but never drawn.
const serverOptions = { resolvers: serverResolvers, blocks: serverBlocks, root: BOX_ROOT, morph: MorphMark };

export const serverPuckConfig = buildPuckConfig(serverOptions);

/**
 * The same page drawn for someone who may edit it (live editor, 2026-11-20): an inert marker before each block, so the
 * Fields lens can offer a block's own words for typing on the page. Never used for a visitor: their markup is
 * `serverPuckConfig`'s, unchanged. (No block of this site fills a setting from a record, so there are no record marks.)
 */
export const markedPuckConfig = buildPuckConfig({ ...serverOptions, marks: true });
