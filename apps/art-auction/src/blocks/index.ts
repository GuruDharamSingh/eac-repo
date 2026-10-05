import type { Block } from "@elkdonis/blocks";
import { countdown, hero, lots, stats, ticker, timeline } from "./auction-blocks";
import { article, discussion, topics } from "./article-blocks";

// ============================================================================
// This site's own page blocks: the live auction set and the article set. The
// editor and the published page both use `[...shared, ...AU_BLOCKS,
// ...HARVEST_BLOCKS]` (lib/puck/catalogue.ts); a block missing from the server
// config renders nothing. A block id is stored in saved page JSON: never
// rename one.
//
//   au-lots, au-timeline, au-hero, au-ticker, au-stats, au-countdown
//        poll /api/auction/live (lib/auction-data.ts)
//   au-article, au-discussion, au-topics
//        a forum topic read as an article (lib/article-data.ts)
//   ha-*  sections adapted from HyperUI (MIT): see harvest/NOTICE.md
// ============================================================================

export const AU_BLOCKS = [hero, countdown, lots, timeline, ticker, stats, article, discussion, topics] as unknown as Block<never>[];
export { HARVEST_BLOCKS } from "./harvest";
