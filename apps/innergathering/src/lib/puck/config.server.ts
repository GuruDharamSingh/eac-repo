import { loadThreadFeed } from "@elkdonis/blocks/server";
import { buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { siteConfig } from "@/config/site";

// ============================================================================
// The catalogue as a PUBLISHED PAGE sees it.
//
// Same components, same fields — different resolvers. These read the database
// directly, because a server rendering its own page has no reason to make an
// HTTP request to itself. Importing this module pulls @elkdonis/db in, so it
// must never be reachable from a client component.
// ============================================================================

const serverResolvers: BlockResolvers = {
  "thread-feed": async (props, metadata) => {
    const orgId = typeof metadata.orgId === "string" ? metadata.orgId : siteConfig.orgId;
    const items = await loadThreadFeed(orgId, {
      limit: typeof props.limit === "number" ? props.limit : 10,
      upcomingOnly: true,
    });
    return { items };
  },
};

export const serverPuckConfig = buildPuckConfig({ resolvers: serverResolvers });
