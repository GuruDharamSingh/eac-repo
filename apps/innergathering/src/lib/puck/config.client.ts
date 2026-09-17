"use client";

import { buildEditorConfig, type BlockResolvers } from "@elkdonis/page-builder";

// ============================================================================
// The catalogue as the EDITOR sees it.
//
// Resolvers here run in the browser, inside Puck's preview iframe, where there
// is no database — so they go over HTTP. The endpoint returns only rows that
// are already published and public, which is the same set the published page
// shows, so the canvas shows the truth rather than a mock.
//
// Everything that is not site-specific — the adapter, the picker, the slider —
// now lives in @elkdonis/page-builder. What stays here is exactly what differs
// between this site and the next one: its feeds and its storage.
// ============================================================================

const clientResolvers: BlockResolvers = {
  "thread-feed": async (props, metadata) => {
    const params = new URLSearchParams();
    if (typeof metadata.orgId === "string") params.set("orgId", metadata.orgId);
    if (typeof props.limit === "number") params.set("limit", String(props.limit));

    try {
      const res = await fetch(`/api/blocks/thread-feed?${params}`);
      if (!res.ok) return { items: [] };
      const body = (await res.json()) as { items?: unknown };
      return { items: Array.isArray(body.items) ? body.items : [] };
    } catch {
      // An editor that cannot reach the feed shows an empty one. Throwing here
      // would leave the block stuck in Puck's loading state with no way out.
      return { items: [] };
    }
  },
};

export const puckConfig = buildEditorConfig({
  resolvers: clientResolvers,
  media: {
    // The same two endpoints the site's own composer uses, so a page block
    // draws on exactly the library an author already knows — org-scoped,
    // editor-gated, backed by this org's Nextcloud folder.
    uploadEndpoint: "/api/upload",
    // Two places to choose from, as separate tabs: what this site has
    // published, and what the person has in their own storage. The org comes
    // first because a page block is usually site material; a personal photo is
    // the deliberate case.
    libraries: [
      { key: "org", label: "This site", endpoint: "/api/media/library" },
      { key: "mine", label: "My files", endpoint: "/api/media/library/mine" },
    ],
  },
});
