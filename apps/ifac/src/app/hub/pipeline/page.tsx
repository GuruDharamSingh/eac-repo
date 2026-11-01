import type { Metadata } from "next";
import { getDeckIdentity } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { getPipelineBoard, listPipelineAssignees } from "@/lib/pipeline";
import { siteConfig } from "@/config/site";
import { PipelineBoard } from "@elkdonis/pipeline";
import { ProvisionBoard } from "@elkdonis/pipeline";
import { HubPageShell } from "@/components/hub/HubPageShell";

export const metadata: Metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

/**
 * The group's Deck board, in full. The Pipeline card on both card layouts
 * comes here. Framed with the site header and a breadcrumb like the other
 * hub pages since 2026-10-10 (it was a bare page with no way back).
 */
export default async function PipelinePage() {
  const viewer = await requireOrgMember("/hub/pipeline");
  const board = await getPipelineBoard();
  const [assignees, viewerUid] = board
    ? await Promise.all([listPipelineAssignees(), getDeckIdentity(viewer.userId)])
    : [[], null];

  return (
    <HubPageShell
      userId={viewer.userId}
      wide
      crumbs={[{ label: "Hub", href: "/hub" }, { label: "Pipeline" }]}
      title={board?.title ?? "Pipeline"}
      intro={
        <p>
          What the group is working on — this is {siteConfig.orgName}&rsquo;s own Nextcloud Deck board, and every
          change here shows up there.
        </p>
      }
    >
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
    </HubPageShell>
  );
}
