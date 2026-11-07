// Mounted read-only over apps/sunjay/src/app/studio/page.tsx in a one-off preview only (sunjay-probe-run.sh); never in the tree.
// It draws the real CanvasEditor and the real server config from JSON files, with no gate, so the editor can be driven in
// Next's real router with no session and no account. Save must not be pressed here: the preview reads elkdonis_dev.
import fs from "node:fs";
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import { loadThreadFeed } from "@elkdonis/blocks/server";
import { buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { serverPuckConfig } from "@/lib/puck/config.server";
import { BLOCK_DATA_IDS, loadBlockData } from "@/lib/puck/block-data";
import { CATALOGUE } from "@/lib/puck/catalogue";
import { CanvasEditor } from "@/components/studio/CanvasEditor";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

const resolvers: BlockResolvers = {
  ...Object.fromEntries(BLOCK_DATA_IDS.map((id) => [id, (props: Record<string, unknown>, metadata: Record<string, unknown>) => loadBlockData(id, props, metadata)])),
  "thread-feed": async (props) => ({ items: await loadThreadFeed(siteConfig.orgId, { limit: typeof props.limit === "number" ? props.limit : 10, upcomingOnly: true }) }),
};
/** config.server.ts as it was before the canvas editor. */
const beforeConfig = buildPuckConfig({ resolvers, blocks: CATALOGUE });

export default async function Probe({ searchParams }: { searchParams: Promise<{ mode?: string; doc?: string; thread?: string }> }) {
  const { mode = "canvas", doc = "seed", thread } = await searchParams;
  const data = JSON.parse(fs.readFileSync(`/h/${doc.replace(/[^a-z-]/g, "")}.json`, "utf8"));
  if (mode === "canvas") return <CanvasEditor slug="try" orgId={siteConfig.orgId} initial={data} />;
  const config = mode === "before" ? beforeConfig : serverPuckConfig;
  const resolved = await resolveAllData(data, config, { orgId: siteConfig.orgId, slug: "try", canEdit: false, ...(thread ? { threadId: thread } : {}) });
  return <Render config={config} data={resolved as never} />;
}
