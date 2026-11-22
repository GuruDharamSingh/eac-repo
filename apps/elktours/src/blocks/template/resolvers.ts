// What the template blocks' resolvers return. No database: the tour comes from the page, or from a sample in the editor.
// A resolver's output is never stored. TEMPLATE lane, 2026-11-21.
import type { BlockResolvers } from "@elkdonis/page-builder/config";
import { samplePage } from "./sample";

export const TEMPLATE_BLOCK_IDS = ["booking-options", "locations"] as const;

/** In the editors: a made-up walk, so the block has something to draw. */
export const templateEditorResolvers: BlockResolvers = Object.fromEntries(
  TEMPLATE_BLOCK_IDS.map((id) => [id, async () => ({ page: samplePage() })])
);

/**
 * On a published page: the page's own tour data when the route passes it as `metadata.tourPage`; otherwise nothing, and the
 * block reads the tour page's provider (blocks/tour/context.tsx), which the tour route wraps its page in.
 */
export const templateServerResolvers: BlockResolvers = Object.fromEntries(
  TEMPLATE_BLOCK_IDS.map((id) => [id, async (_p: Record<string, unknown>, metadata: Record<string, unknown>) => ({ page: metadata?.tourPage ?? null })])
);
