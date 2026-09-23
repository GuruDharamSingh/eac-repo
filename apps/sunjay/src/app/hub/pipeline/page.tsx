import type { Metadata } from "next";
import { getDeckIdentity } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { getPipelineBoard, listPipelineAssignees } from "@/lib/pipeline";
import { siteConfig } from "@/config/site";
import { PipelineBoard } from "@elkdonis/pipeline";
import { ProvisionBoard } from "@elkdonis/pipeline";

export const metadata: Metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const viewer = await requireOrgMember("/hub/pipeline");
  const board = await getPipelineBoard();
  const [assignees, viewerUid] = board
    ? await Promise.all([listPipelineAssignees(), getDeckIdentity(viewer.userId)])
    : [[], null];

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="font-serif text-3xl">{board?.title ?? "Pipeline"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        What the group is working on — this is {siteConfig.orgName}&rsquo;s own Nextcloud Deck
        board, and every change here shows up there.
      </p>
      <div className="mt-8">
        {board ? (
          <PipelineBoard
            board={board}
            assignees={assignees}
            viewerUid={viewerUid}
            canWrite={viewer.isMember}
            canManage={viewer.canEdit}
          />
        ) : (
          <ProvisionBoard canProvision={viewer.canEdit} />
        )}
      </div>
    </div>
  );
}
