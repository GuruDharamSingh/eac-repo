"use client";

import { SHARED_BLOCKS } from "@elkdonis/blocks";
import { buildEditorConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { SITE_BLOCKS } from "@/blocks";

// ============================================================================
// The catalogue as Dana sees it while editing.
//
// The feed resolver is what lets the rest of the network put things ON this
// site: a thread composed in the CMS — a post, a service, an offering —
// appears wherever a Feed block is placed, without anybody editing the page
// again. A page becomes a blog or a services listing by holding that block.
//
// It runs in the BROWSER here, inside the editor's iframe, where there is no
// database — so it goes over HTTP. Its twin in config.server.ts reads the
// database directly, because a server rendering its own page has no reason to
// call itself. Same catalogue, two resolver sets; see the note on
// BlockResolvers.
// ============================================================================

const clientResolvers: BlockResolvers = {
  "thread-feed": async (props) => {
    const params = new URLSearchParams();
    if (typeof props.limit === "number") params.set("limit", String(props.limit));
    try {
      const res = await fetch(`/api/blocks/thread-feed?${params}`);
      if (!res.ok) return { items: [] };
      const body = (await res.json()) as { items?: unknown };
      return { items: Array.isArray(body.items) ? body.items : [] };
    } catch {
      // An editor that cannot reach the feed shows an empty one. Throwing
      // would leave the block stuck in Puck's loading state with no way out.
      return { items: [] };
    }
  },
};

export const puckConfig = buildEditorConfig({
  resolvers: clientResolvers,
  // The shared catalogue plus this site's own. The registry has offered this
  // since it was written — `createCatalogue([...SHARED_BLOCKS, ...orgBlocks])`
  // — and nothing had taken it up until there was a block only one site could
  // safely carry.
  blocks: [...SHARED_BLOCKS, ...SITE_BLOCKS],
  media: {
    // This site's own upload route: images only, stored under the uploader's
    // own folder rather than the org's, matching how her galleries already
    // store work — an artist's pictures follow her.
    uploadEndpoint: "/api/media/upload",
    libraries: [
      { key: "mine", label: "My images", endpoint: "/api/media/library/mine" },
      { key: "site", label: "This site", endpoint: "/api/media/library" },
    ],
  },
});
