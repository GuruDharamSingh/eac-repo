"use client";

import { buildEditorConfig, type BlockResolvers } from "@elkdonis/page-builder";
import type { Config } from "@puckeditor/core";
import { CATALOGUE } from "./catalogue";
import { BLOCK_DATA_IDS } from "./block-ids";

// ============================================================================
// The catalogue as the EDITOR sees it.
//
// Resolvers run in the browser, inside Puck's preview iframe, so they go over
// HTTP to /api/org/<slug>/blocks/<id>. The org comes from the editor's
// metadata (`orgSlug`), set by the route from the URL: the same document
// opened for another org shows that org's rows.
// ============================================================================

async function getJson(url: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return {};
    return (await res.json()) as Record<string, unknown>;
  } catch {
    // An editor that cannot reach the data shows the block empty. Throwing
    // would leave it stuck in Puck's loading state with no way out.
    return {};
  }
}

const clientResolvers: BlockResolvers = Object.fromEntries(
  BLOCK_DATA_IDS.map((id) => [
    id,
    async (props: Record<string, unknown>, metadata: Record<string, unknown>) => {
      const slug = typeof metadata.orgSlug === "string" ? metadata.orgSlug : "";
      if (!slug) return {};
      const q = new URLSearchParams();
      if (typeof props.limit === "number") q.set("limit", String(props.limit));
      return getJson(`/api/org/${encodeURIComponent(slug)}/blocks/${id}?${q}`);
    },
  ])
);

/**
 * The editor config for one org. Built per org because the media endpoints
 * carry the org: uploads land in that org's Nextcloud folder and the library
 * lists that org's files, both gated server-side by `canEditOrgSite`.
 */
export function editorConfigFor(orgSlug: string): Config {
  const slug = encodeURIComponent(orgSlug);
  return buildEditorConfig({
    resolvers: clientResolvers,
    blocks: CATALOGUE,
    media: {
      uploadEndpoint: `/api/upload/image?orgSlug=${slug}&context=Pages`,
      libraries: [{ key: "org", label: "This site", endpoint: `/api/media/library?org=${slug}` }],
    },
  });
}
