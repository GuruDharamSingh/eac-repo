import type { Metadata } from "next";
import { requireNetworkAdmin } from "@/lib/gate";
import { WorkspaceProvider } from "@/workspace/store";
import { Shell } from "@/workspace/Shell";

export const metadata: Metadata = { title: "Workspace" };
export const dynamic = "force-dynamic";

/** Click-through prototype of the workshop workspace. State lives in the browser only (localStorage). */
export default async function WorkspacePage() {
  await requireNetworkAdmin("/workspace");
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}
