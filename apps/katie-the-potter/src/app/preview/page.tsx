import { lookOf } from "@/blocks/looks";
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import { serverPuckConfig } from "@/lib/puck/config.server";
import { DEFAULT_HOME } from "@/lib/default-home";
import { currentOrgId } from "@/lib/site-org";

/**
 * The landing (DEFAULT_HOME) with the grid resolver forced to the sample
 * pieces (`metadata.preview`, see config.server.ts). `?variant=arch|rounded|
 * square` sets the grid's card top, and `?caption=overlay` its caption, so
 * two looks can be compared side by side in screenshots.
 */
export const dynamic = "force-dynamic";

const SHAPES = new Set(["arch", "rounded", "square"]);

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ variant?: string; caption?: string; hover?: string; look?: string }> }) {
  const { variant, caption, hover, look } = await searchParams;
  const data = structuredClone(DEFAULT_HOME) as Data;
  for (const node of data.content) {
    if (node.type !== "ktp-artwork-grid") continue;
    const props = node.props as Record<string, unknown>;
    if (variant && SHAPES.has(variant)) props.topShape = variant;
    if (caption === "overlay" || caption === "below") props.captionPosition = caption;
    if (hover === "none" || hover === "lift" || hover === "glow") props.hover = hover;
  }
  const resolved = await resolveAllData(data, serverPuckConfig, { orgId: currentOrgId(), slug: "preview", preview: true });
  return (
    <div className="ktp-content" data-site-look={lookOf(look) ?? undefined}>
      <Render config={serverPuckConfig} data={resolved as Data} />
    </div>
  );
}
