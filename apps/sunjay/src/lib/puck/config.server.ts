import type { Block } from "@elkdonis/blocks";
import { loadThreadFeed } from "@elkdonis/blocks/server";
import { BOX_BLOCKS } from "@elkdonis/direct-edit/puck/blocks";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { BLOCK_DATA_IDS, loadBlockData } from "./block-data";
import { CATALOGUE } from "./catalogue";
import { PublishedRoot } from "./page-root";
import { siteConfig } from "@/config/site";
import { featuredWho } from "@/lib/featured-person";
import { cardRecord, resolveOpens } from "@/lib/opens-server";

// ============================================================================
// The catalogue as a PUBLISHED page sees it.
//
// Same blocks, same fields, resolvers that read the database directly: a server
// rendering its own page has no reason to call itself over HTTP. `<Render>`
// applies no defaults and runs no resolvers, so every route that renders a page
// calls `resolveAllData` first. Importing this module pulls @elkdonis/db in; it
// must never be reachable from a client component.
// ============================================================================

const serverResolvers: BlockResolvers = {
  ...Object.fromEntries(
    BLOCK_DATA_IDS.map((id) => [
      id,
      (props: Record<string, unknown>, metadata: Record<string, unknown>) => loadBlockData(id, props, metadata),
    ])
  ),
  // Featured person, Opens and a Card from a record (2026-11-07): read per request from the stored reference.
  "featured-person": async (props) => ({ who: await featuredWho(props.person), opened: await resolveOpens(props.opens) }),
  "link-button": async (props) => ({ opened: await resolveOpens(props.opens) }),
  "feature-card": async (props) => ({ bound: await cardRecord(props.record), opened: await resolveOpens(props.opens) }),
  "thread-feed": async (props) => ({
    items: await loadThreadFeed(siteConfig.orgId, {
      limit: typeof props.limit === "number" ? props.limit : 10,
      upcomingOnly: true,
    }),
  }),
};

export const serverPuckConfig = buildPuckConfig({
  resolvers: serverResolvers,
  // The canvas editor's boxes are ordinary blocks to a published page, and a page's look for one block is `morph`.
  blocks: [...CATALOGUE, ...(BOX_BLOCKS as unknown as Block<never>[])],
  root: { props: [], wrap: PublishedRoot },
  morph: MorphMark,
});
