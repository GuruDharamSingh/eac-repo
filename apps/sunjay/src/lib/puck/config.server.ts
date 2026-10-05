import { loadThreadFeed } from "@elkdonis/blocks/server";
import { buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { BLOCK_DATA_IDS, loadBlockData } from "./block-data";
import { CATALOGUE } from "./catalogue";
import { siteConfig } from "@/config/site";

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
  "thread-feed": async (props) => ({
    items: await loadThreadFeed(siteConfig.orgId, {
      limit: typeof props.limit === "number" ? props.limit : 10,
      upcomingOnly: true,
    }),
  }),
};

export const serverPuckConfig = buildPuckConfig({ resolvers: serverResolvers, blocks: CATALOGUE });
