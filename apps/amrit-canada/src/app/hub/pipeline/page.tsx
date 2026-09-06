import type { Metadata } from "next";
import { requireOrgMember } from "@/lib/auth";
import { getPipelineBoard, pipelineWritesEnabled } from "@/lib/pipeline";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";

export const metadata: Metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const viewer = await requireOrgMember("/hub/pipeline");
  const board = await getPipelineBoard();

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="font-serif text-3xl">{board.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        What the group is working on — the same board as the collective&rsquo;s shared Nextcloud.
      </p>
      <div className="mt-8">
        <PipelineBoard board={board} writesEnabled={pipelineWritesEnabled() && viewer.canEdit} />
      </div>
    </div>
  );
}
