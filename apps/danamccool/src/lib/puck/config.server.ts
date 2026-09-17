import { SHARED_BLOCKS } from "@elkdonis/blocks";
import { loadThreadFeed } from "@elkdonis/blocks/server";
import { buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { currentOrgId } from "@/lib/site-org";
import { SITE_BLOCKS } from "@/blocks";

// ============================================================================
// The catalogue as a PUBLISHED page sees it.
//
// Same blocks, same fields, no field controls — a published page renders no
// panel, so the picker and the slider stay out of this graph and out of every
// visitor's bundle.
// ============================================================================

/**
 * The published page's resolvers — the same feed, read straight from the
 * database. `<Render>` applies no defaults and runs no resolvers of its own,
 * which is why every route that renders a page calls `resolveAllData` first;
 * without it a feed would publish whatever happened to be in the document when
 * it was saved.
 */
const serverResolvers: BlockResolvers = {
  "thread-feed": async (props) => {
    const items = await loadThreadFeed(currentOrgId(), {
      limit: typeof props.limit === "number" ? props.limit : 10,
      upcomingOnly: true,
    });
    return { items };
  },
};

export const serverPuckConfig = buildPuckConfig({
  resolvers: serverResolvers,
  blocks: [...SHARED_BLOCKS, ...SITE_BLOCKS],
});
